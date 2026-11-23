"""Synthetic sample: this file is inspected, not imported by FISRE."""

def calculate_price(cost, margin):
    return cost / (1 - margin)


def wrapper(cost, margin):
    return calculate_price(cost, margin)


def dangerous_candidate(path):
    with open(path, "w") as file:
        file.write("example")
