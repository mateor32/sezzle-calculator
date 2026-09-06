// Package calculator implements the arithmetic engine of the service.
//
// The package is deliberately free of any transport concern: every operation is
// a pure function that either returns a finite float64 or one of the sentinel
// errors declared in errors.go. Keeping the rules here makes them trivial to
// unit test and lets the HTTP layer own the decision of how each failure is
// reported to a client.
//
// Operations are described by a small registry rather than a switch statement
// so that arity, guards and behaviour for a given operation all live in one
// place, and adding a new operation is a single map entry.
package calculator

import (
	"math"
	"sort"
	"strings"
)

// Operation is the canonical identifier of a supported operation, exactly as it
// travels over the wire in the "operation" field of a request.
type Operation string

// The complete set of supported operations.
const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	SquareRoot Operation = "sqrt"
	Percentage Operation = "percentage"
)

// Definition describes a single operation.
type Definition struct {
	// Operation is the canonical name of the operation.
	Operation Operation
	// Arity is how many operands the operation consumes: 1 or 2.
	Arity int

	// guard rejects operand combinations that are invalid before any
	// arithmetic runs. It is nil for operations that are total over their
	// finite inputs.
	guard func(operands []float64) error
	// apply performs the arithmetic. It is only called once the arity, the
	// finiteness of every operand and the guard have all been checked, so it
	// can index operands without bounds checks.
	apply func(operands []float64) float64
}

var definitions = map[Operation]Definition{
	Add: {
		Operation: Add,
		Arity:     2,
		apply:     func(o []float64) float64 { return o[0] + o[1] },
	},
	Subtract: {
		Operation: Subtract,
		Arity:     2,
		apply:     func(o []float64) float64 { return o[0] - o[1] },
	},
	Multiply: {
		Operation: Multiply,
		Arity:     2,
		apply:     func(o []float64) float64 { return o[0] * o[1] },
	},
	Divide: {
		Operation: Divide,
		Arity:     2,
		guard: func(o []float64) error {
			// Note that this also catches negative zero, which would otherwise
			// yield -Inf rather than an error.
			if o[1] == 0 {
				return ErrDivisionByZero
			}
			return nil
		},
		apply: func(o []float64) float64 { return o[0] / o[1] },
	},
	Power: {
		Operation: Power,
		Arity:     2,
		// A negative base with a fractional exponent yields NaN and an
		// excessive exponent yields ±Inf; both are caught by the post-condition
		// check in Calculate rather than by a guard.
		apply: func(o []float64) float64 { return math.Pow(o[0], o[1]) },
	},
	SquareRoot: {
		Operation: SquareRoot,
		Arity:     1,
		guard: func(o []float64) error {
			if o[0] < 0 {
				return ErrNegativeSquareRoot
			}
			return nil
		},
		apply: func(o []float64) float64 { return math.Sqrt(o[0]) },
	},
	Percentage: {
		Operation: Percentage,
		Arity:     2,
		// "b percent of a". Dividing before multiplying keeps large values of a
		// away from an intermediate overflow.
		apply: func(o []float64) float64 { return o[0] * (o[1] / 100) },
	},
}

// Lookup resolves an operation name to its definition. Names are matched after
// trimming surrounding whitespace and lower-casing, so "  ADD " resolves to
// Add. The second return value reports whether the operation is supported.
func Lookup(name string) (Definition, bool) {
	def, ok := definitions[Operation(strings.ToLower(strings.TrimSpace(name)))]
	return def, ok
}

// SupportedOperations returns the canonical names of every supported operation
// in alphabetical order. It is used to build helpful validation messages.
func SupportedOperations() []string {
	names := make([]string, 0, len(definitions))
	for name := range definitions {
		names = append(names, string(name))
	}
	sort.Strings(names)
	return names
}

// Calculate applies op to operands and returns a finite result.
//
// It validates, in order: that the operation exists, that the operand count
// matches the operation's arity, that every operand is finite, that the
// operation's own precondition holds, and finally that the computed value is a
// real number inside the float64 range. Any failure is reported as one of the
// sentinel errors in errors.go.
func Calculate(op Operation, operands []float64) (float64, error) {
	def, ok := definitions[op]
	if !ok {
		return 0, ErrUnknownOperation
	}

	if len(operands) != def.Arity {
		return 0, ErrInvalidOperandCount
	}

	for _, operand := range operands {
		if math.IsNaN(operand) || math.IsInf(operand, 0) {
			return 0, ErrNonFiniteOperand
		}
	}

	if def.guard != nil {
		if err := def.guard(operands); err != nil {
			return 0, err
		}
	}

	result := def.apply(operands)

	switch {
	case math.IsNaN(result):
		return 0, ErrUndefinedResult
	case math.IsInf(result, 0):
		return 0, ErrOverflow
	}

	if result == 0 {
		// Normalise negative zero to positive zero: "-0" carries no meaning on
		// a calculator display and would otherwise leak into the JSON body of
		// results such as -5 x 0.
		result = 0
	}

	return result, nil
}
