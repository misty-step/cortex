package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Session represents a parsed OpenClaw session
type Session struct {
	ID        string
	Agent     string
	Type      string // interactive, cron, subagent
	CronID    string // for cron sessions
	Timestamp time.Time
	Messages  []Message
	Cost      float64
	Tokens    TokenCount
}

// Message represents a single message in a session
type Message struct {
	Role      string
	Model     string
	Cost      float64
	Tokens    TokenCount
	Timestamp time.Time
}

// TokenCount represents input/output tokens
type TokenCount struct {
	Input  int
	Output int
	Total  int
}

// SessionInfo from sessions.json index
type SessionInfo struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Label     string    `json:"label,omitempty"`
	StartedAt time.Time `json:"startedAt"`
}

// ParseAllSessions walks the ~/.openclaw directory and parses all sessions
func ParseAllSessions(dataDir string) ([]Session, error) {
	var sessions []Session

	agentsDir := filepath.Join(dataDir, "agents")
	entries, err := os.ReadDir(agentsDir)
	if err != nil {
		return nil, fmt.Errorf("reading agents dir: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		agentName := entry.Name()
		agentSessions, err := parseAgentSessions(filepath.Join(agentsDir, agentName), agentName)
		if err != nil {
			// Log error but continue with other agents
			fmt.Fprintf(os.Stderr, "Warning: parsing agent %s: %v\n", agentName, err)
			continue
		}

		sessions = append(sessions, agentSessions...)
	}

	return sessions, nil
}

func parseAgentSessions(agentDir, agentName string) ([]Session, error) {
	sessionsDir := filepath.Join(agentDir, "sessions")

	// Check if sessions directory exists
	if _, err := os.Stat(sessionsDir); os.IsNotExist(err) {
		return nil, nil // No sessions for this agent
	}

	var sessions []Session

	// Read session index if it exists
	sessionIndex := make(map[string]SessionInfo)
	indexPath := filepath.Join(sessionsDir, "sessions.json")
	if data, err := os.ReadFile(indexPath); err == nil {
		var index struct {
			Sessions []SessionInfo `json:"sessions"`
		}
		if err := json.Unmarshal(data, &index); err == nil {
			for _, s := range index.Sessions {
				sessionIndex[s.ID] = s
			}
		}
	}

	// Walk session files
	entries, err := os.ReadDir(sessionsDir)
	if err != nil {
		return nil, fmt.Errorf("reading sessions dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !strings.HasSuffix(name, ".jsonl") {
			continue
		}

		sessionID := strings.TrimSuffix(name, ".jsonl")
		sessionPath := filepath.Join(sessionsDir, name)

		session, err := parseSessionFile(sessionPath, agentName, sessionID, sessionIndex[sessionID])
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: parsing session %s: %v\n", sessionID, err)
			continue
		}

		sessions = append(sessions, session)
	}

	return sessions, nil
}

func parseSessionFile(path, agentName, sessionID string, info SessionInfo) (Session, error) {
	session := Session{
		ID:     sessionID,
		Agent:  agentName,
		Type:   "interactive", // default
		Tokens: TokenCount{},
	}

	// Parse session type and cron ID from session key or index info
	if info.ID != "" {
		if info.Type != "" {
			session.Type = info.Type
		}
		session.Timestamp = info.StartedAt
		if info.Label != "" {
			session.CronID = info.Label
		}
	} else {
		// Try to infer from session ID format
		// agent:{name}:cron:{id}:run:{sid} or agent:{name}:subagent:{sid}
		if strings.Contains(sessionID, ":cron:") {
			session.Type = "cron"
			parts := strings.Split(sessionID, ":")
			for i, p := range parts {
				if p == "cron" && i+1 < len(parts) {
					session.CronID = parts[i+1]
					break
				}
			}
		} else if strings.Contains(sessionID, ":subagent:") {
			session.Type = "subagent"
		}
	}

	// Fallback: use file modification time when no timestamp from index
	if session.Timestamp.IsZero() {
		if fi, err := os.Stat(path); err == nil {
			session.Timestamp = fi.ModTime()
		}
	}

	file, err := os.Open(path)
	if err != nil {
		return session, fmt.Errorf("opening file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	// Increase buffer size to handle large JSON lines (64KB)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var entry struct {
			Type      string          `json:"type"`
			Timestamp json.RawMessage `json:"timestamp"` // Can be string or number
			Message   json.RawMessage `json:"message"`
		}

		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue // Skip malformed lines
		}

		if entry.Type == "message" && len(entry.Message) > 0 {
			var msgContent struct {
				Role  string `json:"role"`
				Model string `json:"model"`
				Usage struct {
					Input       int `json:"input"`
					Output      int `json:"output"`
					TotalTokens int `json:"totalTokens"`
					Cost        struct {
						Input      float64 `json:"input"`
						Output     float64 `json:"output"`
						Total      float64 `json:"total"`
						CacheRead  float64 `json:"cacheRead"`
						CacheWrite float64 `json:"cacheWrite"`
					} `json:"cost"`
				} `json:"usage"`
			}

			if err := json.Unmarshal(entry.Message, &msgContent); err != nil {
				continue // Skip if can't parse message content
			}

			// Only process messages that have a model (assistant/tool responses)
			if msgContent.Model != "" {
				msg := Message{
					Role:  msgContent.Role,
					Model: msgContent.Model,
					Cost:  msgContent.Usage.Cost.Total,
					Tokens: TokenCount{
						Input:  msgContent.Usage.Input,
						Output: msgContent.Usage.Output,
						Total:  msgContent.Usage.TotalTokens,
					},
				}
				session.Messages = append(session.Messages, msg)

				// Accumulate cost and tokens
				session.Cost += msgContent.Usage.Cost.Total
				session.Tokens.Input += msgContent.Usage.Input
				session.Tokens.Output += msgContent.Usage.Output
				session.Tokens.Total += msgContent.Usage.TotalTokens
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return session, fmt.Errorf("scanning file: %w", err)
	}

	return session, nil
}
