package scheduler

import (
	"strings"
	"time"
)

// Clock defines an interface for getting the current time.
// This allows us to inject a fake time during unit tests.
type Clock interface {
	Now() time.Time
}

// RealClock implements Clock using the actual server system time.
type RealClock struct{}

func (c RealClock) Now() time.Time {
	return time.Now()
}

// MockClock implements Clock for testing specific scenarios.
// e.g., "Pretend it is Friday at 23:59:59"
type MockClock struct {
	MockTime time.Time
}

func (m MockClock) Now() time.Time {
	return m.MockTime
}

// ---------------------------------------------------------
// Time Evaluation Utilities
// ---------------------------------------------------------

// IsDayMatch checks if the current weekday is in the scheduled days list.
// Example: IsDayMatch("Mon,Wed,Fri", "Wed") -> true
func IsDayMatch(scheduledDays, currentWeekday string) bool {
	if scheduledDays == "" {
		return false
	}
	return strings.Contains(scheduledDays, currentWeekday)
}

// IsTimeMatch handles standard ranges (09:00-11:00) and cross-midnight ranges (22:00-02:00).
func IsTimeMatch(start, end, current string) bool {
	if start == "" || end == "" {
		return false
	}
	if start <= end {
		// Standard range: Start <= Current < End
		return current >= start && current < end
	}
	// Midnight crossover: (Current >= Start) OR (Current < End)
	return current >= start || current < end
}
