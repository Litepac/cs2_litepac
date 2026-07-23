package demo

import "testing"

func TestSanitizedYawNormalizesSource2Range(t *testing.T) {
	tests := []struct {
		name string
		in   float64
		want float64
	}{
		{name: "zero", in: 0, want: 0},
		{name: "positive", in: 90, want: 90},
		{name: "wraps above half turn", in: 270, want: -90},
		{name: "full turn", in: 360, want: 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := sanitizedYaw(test.in)
			if got == nil || *got != test.want {
				t.Fatalf("expected %.1f, got %v", test.want, got)
			}
		})
	}
}

func TestSanitizedPitchNormalizesSource2EyeAngleRange(t *testing.T) {
	tests := []struct {
		name string
		in   float64
		want float64
	}{
		{name: "level", in: 0, want: 0},
		{name: "down", in: 45, want: 45},
		{name: "up encoded near full turn", in: 315, want: -45},
		{name: "straight up encoded as 270", in: 270, want: -90},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := sanitizedPitch(test.in)
			if got == nil || *got != test.want {
				t.Fatalf("expected %.1f, got %v", test.want, got)
			}
		})
	}
}
