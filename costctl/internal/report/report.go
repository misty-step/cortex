package report

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/misty-step/cortex/costctl/internal/parser"
)

// FullReport contains all cost breakdowns
type FullReport struct {
	TotalCost      float64                `json:"total_cost"`
	TotalSessions  int                    `json:"total_sessions"`
	TotalMessages  int                    `json:"total_messages"`
	ByAgent        map[string]float64     `json:"by_agent"`
	ByType         map[string]float64     `json:"by_type"`
	ByModel        map[string]float64     `json:"by_model"`
	ByCron         map[string]float64     `json:"by_cron,omitempty"`
	Sessions       []SessionSummary       `json:"sessions,omitempty"`
}

// SessionSummary for detailed reports
type SessionSummary struct {
	ID       string  `json:"id"`
	Agent    string  `json:"agent"`
	Type     string  `json:"type"`
	Cost     float64 `json:"cost"`
	Messages int     `json:"messages"`
}

// GenerateFullReport creates a comprehensive cost report
func GenerateFullReport(sessions []parser.Session, format string) string {
	report := buildFullReport(sessions)

	if format == "json" {
		data, _ := json.MarshalIndent(report, "", "  ")
		return string(data)
	}

	return formatFullReportText(report)
}

// GenerateCronReport creates a report focused on cron costs
func GenerateCronReport(sessions []parser.Session, format string) string {
	cronCosts := make(map[string]float64)
	var totalCost float64

	for _, s := range sessions {
		if s.Type == "cron" {
			totalCost += s.Cost
			if s.CronID != "" {
				cronCosts[s.CronID] += s.Cost
			} else {
				cronCosts["(unnamed)"] += s.Cost
			}
		}
	}

	if format == "json" {
		data, _ := json.MarshalIndent(map[string]interface{}{
			"total_cron_cost": totalCost,
			"by_cron":         cronCosts,
		}, "", "  ")
		return string(data)
	}

	var b strings.Builder
	b.WriteString("═╦═ Cron Cost Report ═╦═\n\n")
	b.WriteString(fmt.Sprintf("Total Cron Cost: $%.4f\n\n", totalCost))

	// Sort crons by cost
	type cronEntry struct {
		name string
		cost float64
	}
	var entries []cronEntry
	for name, cost := range cronCosts {
		entries = append(entries, cronEntry{name, cost})
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].cost > entries[j].cost
	})

	b.WriteString("Top Crons by Cost:\n")
	for _, e := range entries {
		pct := 0.0
		if totalCost > 0 {
			pct = (e.cost / totalCost) * 100
		}
		b.WriteString(fmt.Sprintf("  %-30s $%8.4f (%5.1f%%)\n", e.name, e.cost, pct))
	}

	return b.String()
}

// GenerateModelReport creates a report focused on model costs
func GenerateModelReport(sessions []parser.Session, format string) string {
	modelCosts := make(map[string]float64)
	modelTokens := make(map[string]int)
	var totalCost float64

	for _, s := range sessions {
		totalCost += s.Cost
		for _, m := range s.Messages {
			if m.Model != "" {
				modelCosts[m.Model] += m.Cost
				modelTokens[m.Model] += m.Tokens.Total
			}
		}
	}

	if format == "json" {
		data, _ := json.MarshalIndent(map[string]interface{}{
			"total_cost": totalCost,
			"by_model":   modelCosts,
		}, "", "  ")
		return string(data)
	}

	var b strings.Builder
	b.WriteString("═╦═ Model Cost Report ═╦═\n\n")
	b.WriteString(fmt.Sprintf("Total Cost: $%.4f\n\n", totalCost))

	// Sort models by cost
	type modelEntry struct {
		name   string
		cost   float64
		tokens int
	}
	var entries []modelEntry
	for name, cost := range modelCosts {
		entries = append(entries, modelEntry{name, cost, modelTokens[name]})
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].cost > entries[j].cost
	})

	b.WriteString("Models by Cost:\n")
	b.WriteString(fmt.Sprintf("  %-40s %10s %12s %8s\n", "Model", "Cost", "Tokens", "%"))
	b.WriteString(strings.Repeat("-", 75) + "\n")
	for _, e := range entries {
		pct := 0.0
		if totalCost > 0 {
			pct = (e.cost / totalCost) * 100
		}
		b.WriteString(fmt.Sprintf("  %-40s $%8.4f %12d %7.1f%%\n",
			truncate(e.name, 40), e.cost, e.tokens, pct))
	}

	return b.String()
}

func buildFullReport(sessions []parser.Session) FullReport {
	r := FullReport{
		ByAgent:    make(map[string]float64),
		ByType:     make(map[string]float64),
		ByModel:    make(map[string]float64),
		ByCron:     make(map[string]float64),
		Sessions:   make([]SessionSummary, 0, len(sessions)),
	}

	modelSeen := make(map[string]bool)

	for _, s := range sessions {
		r.TotalCost += s.Cost
		r.TotalSessions++
		r.TotalMessages += len(s.Messages)

		r.ByAgent[s.Agent] += s.Cost
		r.ByType[s.Type] += s.Cost

		if s.Type == "cron" && s.CronID != "" {
			r.ByCron[s.CronID] += s.Cost
		}

		for _, m := range s.Messages {
			if m.Model != "" {
				r.ByModel[m.Model] += m.Cost
				modelSeen[m.Model] = true
			}
		}

		r.Sessions = append(r.Sessions, SessionSummary{
			ID:       s.ID,
			Agent:    s.Agent,
			Type:     s.Type,
			Cost:     s.Cost,
			Messages: len(s.Messages),
		})
	}

	return r
}

func formatFullReportText(r FullReport) string {
	var b strings.Builder

	b.WriteString("╔════════════════════════════════════════════════════════╗\n")
	b.WriteString("║         OpenClaw Cost Observatory Report               ║\n")
	b.WriteString("╚════════════════════════════════════════════════════════╝\n\n")

	b.WriteString(fmt.Sprintf("Total Cost:     $%.4f\n", r.TotalCost))
	b.WriteString(fmt.Sprintf("Total Sessions: %d\n", r.TotalSessions))
	b.WriteString(fmt.Sprintf("Total Messages: %d\n\n", r.TotalMessages))

	// By Agent
	b.WriteString("━╦━ By Agent ═╦━\n")
	for _, item := range sortedMap(r.ByAgent) {
		pct := (item.value / r.TotalCost) * 100
		b.WriteString(fmt.Sprintf("  %-15s $%8.4f (%5.1f%%)\n", item.key, item.value, pct))
	}
	b.WriteString("\n")

	// By Type
	b.WriteString("━╦━ By Session Type ═╦━\n")
	for _, item := range sortedMap(r.ByType) {
		pct := (item.value / r.TotalCost) * 100
		b.WriteString(fmt.Sprintf("  %-15s $%8.4f (%5.1f%%)\n", item.key, item.value, pct))
	}
	b.WriteString("\n")

	// By Model
	b.WriteString("━╦━ By Model ═╦━\n")
	for _, item := range sortedMap(r.ByModel) {
		pct := (item.value / r.TotalCost) * 100
		b.WriteString(fmt.Sprintf("  %-40s $%8.4f (%5.1f%%)\n", truncate(item.key, 40), item.value, pct))
	}

	return b.String()
}

func sortedMap(m map[string]float64) []struct {
	key   string
	value float64
} {
	var items []struct {
		key   string
		value float64
	}
	for k, v := range m {
		items = append(items, struct {
			key   string
			value float64
		}{k, v})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].value > items[j].value
	})
	return items
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}
