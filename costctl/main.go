package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/misty-step/cortex/costctl/internal/parser"
	"github.com/misty-step/cortex/costctl/internal/report"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	if cmd != "report" {
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", cmd)
		printUsage()
		os.Exit(1)
	}

	// Parse flags
	var (
		period     = "all"
		agent      = ""
		crons      = false
		models     = false
		full       = false
		format     = "text"
		dataDir    = os.ExpandEnv("$HOME/.openclaw")
	)

	for i := 2; i < len(os.Args); i++ {
		switch os.Args[i] {
		case "--period":
			if i+1 < len(os.Args) {
				period = os.Args[i+1]
				i++
			}
		case "--agent":
			if i+1 < len(os.Args) {
				agent = os.Args[i+1]
				i++
			}
		case "--crons":
			crons = true
		case "--models":
			models = true
		case "--full":
			full = true
		case "--format":
			if i+1 < len(os.Args) {
				format = os.Args[i+1]
				i++
			}
		case "--data-dir":
			if i+1 < len(os.Args) {
				dataDir = os.Args[i+1]
				i++
			}
		}
	}

	// Reject mutually exclusive flags
	if crons && models {
		fmt.Fprintln(os.Stderr, "Error: --crons and --models are mutually exclusive")
		os.Exit(1)
	}

	// If no specific report type, default to full
	if !crons && !models && agent == "" {
		full = true
	}

	// Parse all sessions
	sessions, err := parser.ParseAllSessions(dataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing sessions: %v\n", err)
		os.Exit(1)
	}

	// Filter by period
	sessions = filterByPeriod(sessions, period)

	// Filter by agent if specified
	if agent != "" {
		sessions = filterByAgent(sessions, agent)
	}

	// Generate report
	var output string
	switch {
	case full:
		output = report.GenerateFullReport(sessions, format)
	case crons:
		output = report.GenerateCronReport(sessions, format)
	case models:
		output = report.GenerateModelReport(sessions, format)
	default:
		output = report.GenerateFullReport(sessions, format)
	}

	fmt.Println(output)
}

func printUsage() {
	fmt.Println(`costctl - OpenClaw cost observability tool

Usage:
  costctl report [flags]

Flags:
  --period today|yesterday|week|month|all   Time period (default: all)
  --agent NAME                              Filter by agent (main, amos, pepper, etc.)
  --crons                                   Show cron cost ranking
  --models                                  Show model cost comparison
  --full                                    Show all dimensions (default)
  --format json|text                        Output format (default: text)
  --data-dir PATH                           Path to .openclaw data (default: ~/.openclaw)

Examples:
  costctl report --period yesterday
  costctl report --agent amos --format json
  costctl report --crons --period week`)
}

func filterByPeriod(sessions []parser.Session, period string) []parser.Session {
	now := time.Now()
	var startTime time.Time
	var endTime time.Time
	hasEnd := false

	switch period {
	case "today":
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case "yesterday":
		yesterday := now.AddDate(0, 0, -1)
		startTime = time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, now.Location())
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		hasEnd = true
	case "week":
		startTime = now.AddDate(0, 0, -7)
	case "month":
		startTime = now.AddDate(0, -1, 0)
	default:
		return sessions
	}

	var filtered []parser.Session
	for _, s := range sessions {
		if s.Timestamp.After(startTime) && (!hasEnd || s.Timestamp.Before(endTime)) {
			filtered = append(filtered, s)
		}
	}
	return filtered
}

func filterByAgent(sessions []parser.Session, agent string) []parser.Session {
	var filtered []parser.Session
	for _, s := range sessions {
		if strings.EqualFold(s.Agent, agent) {
			filtered = append(filtered, s)
		}
	}
	return filtered
}
