"""
Sample Python program for testing LCP
"""


def factorial(n: int) -> int:
    """Calculate factorial of n"""
    if n <= 1:
        return 1
    return n * factorial(n - 1)


def fibonacci(n: int) -> int:
    """Calculate nth Fibonacci number"""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


class Calculator:
    """Simple calculator class"""

    def __init__(self):
        self.result = 0

    def add(self, x: float, y: float) -> float:
        """Add two numbers"""
        self.result = x + y
        return self.result

    def subtract(self, x: float, y: float) -> float:
        """Subtract y from x"""
        self.result = x - y
        return self.result

    def multiply(self, x: float, y: float) -> float:
        """Multiply two numbers"""
        self.result = x * y
        return self.result

    def divide(self, x: float, y: float) -> float:
        """Divide x by y"""
        if y == 0:
            raise ValueError("Cannot divide by zero")
        self.result = x / y
        return self.result


def main():
    """Main function"""
    print("Testing factorial:")
    for i in range(6):
        print(f"factorial({i}) = {factorial(i)}")

    print("\nTesting Fibonacci:")
    for i in range(10):
        print(f"fibonacci({i}) = {fibonacci(i)}")

    print("\nTesting Calculator:")
    calc = Calculator()
    print(f"5 + 3 = {calc.add(5, 3)}")
    print(f"10 - 4 = {calc.subtract(10, 4)}")
    print(f"6 * 7 = {calc.multiply(6, 7)}")
    print(f"20 / 4 = {calc.divide(20, 4)}")

    # This will cause an error for testing diagnostics
    # undefined_variable = some_undefined_value


if __name__ == "__main__":
    main()
