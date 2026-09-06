package calculator

import "errors"

// Sentinel errors returned by Calculate. The transport layer matches on these
// with errors.Is to decide which HTTP status code and machine readable error
// code a client should receive, so the calculator package never has to know
// anything about HTTP.
var (
	// ErrUnknownOperation is returned when the requested operation is not part
	// of the supported set.
	ErrUnknownOperation = errors.New("unknown operation")

	// ErrInvalidOperandCount is returned when the number of operands does not
	// match the arity of the requested operation.
	ErrInvalidOperandCount = errors.New("invalid number of operands for the requested operation")

	// ErrNonFiniteOperand is returned when an operand is NaN or ±Inf. Standard
	// JSON cannot carry those values, but the guard keeps the package safe for
	// any other caller.
	ErrNonFiniteOperand = errors.New("operands must be finite numbers")

	// ErrDivisionByZero is returned when a division has a zero divisor.
	ErrDivisionByZero = errors.New("division by zero is undefined")

	// ErrNegativeSquareRoot is returned when a square root is asked for a
	// negative radicand, which has no real result.
	ErrNegativeSquareRoot = errors.New("the square root of a negative number is not a real number")

	// ErrOverflow is returned when a mathematically valid operation produces a
	// value outside the range representable by a float64.
	ErrOverflow = errors.New("the result is too large to be represented as a 64-bit floating point number")

	// ErrUndefinedResult is returned when an operation produces NaN, for
	// example a negative base raised to a fractional exponent.
	ErrUndefinedResult = errors.New("the operation does not produce a real number for the given operands")
)
