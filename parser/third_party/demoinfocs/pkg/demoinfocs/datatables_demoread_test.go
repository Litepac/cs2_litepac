package demoinfocs

import (
	"testing"

	st "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/sendtables"
)

func TestDemoReadNilBombPropertyValuesAreAbsent(t *testing.T) {
	if value, ok := optionalPropertyBool(st.PropertyValue{}); ok || value {
		t.Fatalf("expected nil bool property to be absent, got value=%t ok=%t", value, ok)
	}

	if value, ok := optionalPropertyHandle(st.PropertyValue{}); ok || value != 0 {
		t.Fatalf("expected nil handle property to be absent, got value=%d ok=%t", value, ok)
	}
}

func TestDemoReadBombPropertyValuesRetainTypedValues(t *testing.T) {
	if value, ok := optionalPropertyBool(st.PropertyValue{Any: true}); !ok || !value {
		t.Fatalf("expected true bool property, got value=%t ok=%t", value, ok)
	}

	const handle uint64 = 42
	if value, ok := optionalPropertyHandle(st.PropertyValue{Any: handle}); !ok || value != handle {
		t.Fatalf("expected handle %d, got value=%d ok=%t", handle, value, ok)
	}
}
