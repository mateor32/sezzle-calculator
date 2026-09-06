package calculator_test

import (
	"errors"
	"math"
	"testing"

	"calculator-api/internal/calculator"
)

// tolerance for comparisons of results that are not exactly representable in
// binary floating point.
const tolerance = 1e-9

func TestCalculateSuccess(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		op       calculator.Operation
		operands []float64
		want     float64
	}{
		// Required operations.
		{"add positives", calculator.Add, []float64{2, 3}, 5},
		{"add negatives", calculator.Add, []float64{-2, -3}, -5},
		{"add decimals", calculator.Add, []float64{0.1, 0.2}, 0.3},
		{"subtract to positive", calculator.Subtract, []float64{10, 4}, 6},
		{"subtract to negative", calculator.Subtract, []float64{4, 10}, -6},
		{"multiply", calculator.Multiply, []float64{7, 6}, 42},
		{"multiply by zero", calculator.Multiply, []float64{7, 0}, 0},
		{"multiply decimals", calculator.Multiply, []float64{2.5, 4}, 10},
		{"divide exact", calculator.Divide, []float64{10, 2}, 5},
		{"divide fractional", calculator.Divide, []float64{10, 4}, 2.5},
		{"divide negative divisor", calculator.Divide, []float64{10, -4}, -2.5},

		// Optional operations.
		{"power positive exponent", calculator.Power, []float64{2, 10}, 1024},
		{"power zero exponent", calculator.Power, []float64{5, 0}, 1},
		{"power negative exponent", calculator.Power, []float64{2, -2}, 0.25},
		{"power fractional exponent", calculator.Power, []float64{9, 0.5}, 3},
		{"square root perfect", calculator.SquareRoot, []float64{9}, 3},
		{"square root of zero", calculator.SquareRoot, []float64{0}, 0},
		{"square root irrational", calculator.SquareRoot, []float64{2}, math.Sqrt2},
		{"percentage", calculator.Percentage, []float64{200, 10}, 20},
		{"percentage over one hundred", calculator.Percentage, []float64{50, 250}, 125},
		{"percentage of zero", calculator.Percentage, []float64{0, 10}, 0},
		{"percentage negative base", calculator.Percentage, []float64{-200, 10}, -20},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := calculator.Calculate(tt.op, tt.operands)
			if err != nil {
				t.Fatalf("Calculate(%q, %v) returned unexpected error: %v", tt.op, tt.operands, err)
			}
			if math.Abs(got-tt.want) > tolerance {
				t.Errorf("Calculate(%q, %v) = %v, want %v", tt.op, tt.operands, got, tt.want)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		op       calculator.Operation
		operands []float64
		want     error
	}{
		{"divide by zero", calculator.Divide, []float64{10, 0}, calculator.ErrDivisionByZero},
		{"divide by negative zero", calculator.Divide, []float64{10, math.Copysign(0, -1)}, calculator.ErrDivisionByZero},
		{"zero divided by zero", calculator.Divide, []float64{0, 0}, calculator.ErrDivisionByZero},
		{"square root of a negative number", calculator.SquareRoot, []float64{-9}, calculator.ErrNegativeSquareRoot},

		{"addition overflows", calculator.Add, []float64{math.MaxFloat64, math.MaxFloat64}, calculator.ErrOverflow},
		{"multiplication overflows", calculator.Multiply, []float64{math.MaxFloat64, 2}, calculator.ErrOverflow},
		{"power overflows", calculator.Power, []float64{10, 400}, calculator.ErrOverflow},
		{"power of zero to a negative exponent overflows", calculator.Power, []float64{0, -1}, calculator.ErrOverflow},
		{"percentage overflows", calculator.Percentage, []float64{math.MaxFloat64, 1000}, calculator.ErrOverflow},

		{"negative base with a fractional exponent is undefined", calculator.Power, []float64{-8, 0.5}, calculator.ErrUndefinedResult},

		{"unknown operation", calculator.Operation("modulo"), []float64{1, 2}, calculator.ErrUnknownOperation},
		{"empty operation", calculator.Operation(""), []float64{1, 2}, calculator.ErrUnknownOperation},

		{"too few operands", calculator.Add, []float64{1}, calculator.ErrInvalidOperandCount},
		{"too many operands", calculator.SquareRoot, []float64{1, 2}, calculator.ErrInvalidOperandCount},
		{"no operands", calculator.Add, nil, calculator.ErrInvalidOperandCount},

		{"NaN operand", calculator.Add, []float64{math.NaN(), 1}, calculator.ErrNonFiniteOperand},
		{"infinite operand", calculator.Add, []float64{math.Inf(1), 1}, calculator.ErrNonFiniteOperand},
		{"negative infinite operand", calculator.Multiply, []float64{2, math.Inf(-1)}, calculator.ErrNonFiniteOperand},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := calculator.Calculate(tt.op, tt.operands)
			if !errors.Is(err, tt.want) {
				t.Fatalf("Calculate(%q, %v) error = %v, want %v", tt.op, tt.operands, err, tt.want)
			}
			if got != 0 {
				t.Errorf("Calculate(%q, %v) = %v, want the zero value alongside an error", tt.op, tt.operands, got)
			}
		})
	}
}

// A result of exactly zero must never be reported as negative zero, because it
// would be serialised as "-0" and shown as such to the user.
func TestCalculateNormalisesNegativeZero(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		op       calculator.Operation
		operands []float64
	}{
		{"negative times zero", calculator.Multiply, []float64{-5, 0}},
		{"zero divided by a negative number", calculator.Divide, []float64{0, -5}},
		{"percentage of a negative base with a zero rate", calculator.Percentage, []float64{-200, 0}},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := calculator.Calculate(tt.op, tt.operands)
			if err != nil {
				t.Fatalf("Calculate(%q, %v) returned unexpected error: %v", tt.op, tt.operands, err)
			}
			if got != 0 || math.Signbit(got) {
				t.Errorf("Calculate(%q, %v) = %v (signbit %t), want positive zero", tt.op, tt.operands, got, math.Signbit(got))
			}
		})
	}
}

func TestLookup(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		input     string
		wantOp    calculator.Operation
		wantArity int
		wantFound bool
	}{
		{"canonical name", "add", calculator.Add, 2, true},
		{"uppercase name", "DIVIDE", calculator.Divide, 2, true},
		{"surrounding whitespace", "  sqrt  ", calculator.SquareRoot, 1, true},
		{"unary arity", "sqrt", calculator.SquareRoot, 1, true},
		{"binary arity", "percentage", calculator.Percentage, 2, true},
		{"unsupported name", "modulo", "", 0, false},
		{"empty name", "", "", 0, false},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			def, found := calculator.Lookup(tt.input)
			if found != tt.wantFound {
				t.Fatalf("Lookup(%q) found = %t, want %t", tt.input, found, tt.wantFound)
			}
			if !tt.wantFound {
				return
			}
			if def.Operation != tt.wantOp {
				t.Errorf("Lookup(%q).Operation = %q, want %q", tt.input, def.Operation, tt.wantOp)
			}
			if def.Arity != tt.wantArity {
				t.Errorf("Lookup(%q).Arity = %d, want %d", tt.input, def.Arity, tt.wantArity)
			}
		})
	}
}

func TestSupportedOperationsIsSortedAndComplete(t *testing.T) {
	t.Parallel()

	want := []string{"add", "divide", "multiply", "percentage", "power", "sqrt", "subtract"}

	got := calculator.SupportedOperations()
	if len(got) != len(want) {
		t.Fatalf("SupportedOperations() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("SupportedOperations() = %v, want %v", got, want)
		}
	}
}

// Every supported operation must be resolvable and executable, so that adding
// an entry to the registry without wiring it up correctly fails the suite.
func TestEverySupportedOperationIsExecutable(t *testing.T) {
	t.Parallel()

	for _, name := range calculator.SupportedOperations() {
		name := name
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			def, ok := calculator.Lookup(name)
			if !ok {
				t.Fatalf("Lookup(%q) reported the operation as unsupported", name)
			}
			if def.Arity != 1 && def.Arity != 2 {
				t.Fatalf("operation %q has arity %d, want 1 or 2", name, def.Arity)
			}

			// 4 and 2 are safe operands for every current operation: they are
			// positive, non-zero and produce results well inside float64 range.
			operands := []float64{4, 2}[:def.Arity]
			if _, err := calculator.Calculate(def.Operation, operands); err != nil {
				t.Errorf("Calculate(%q, %v) returned unexpected error: %v", name, operands, err)
			}
		})
	}
}
