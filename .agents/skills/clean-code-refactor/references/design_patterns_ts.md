# Modern Design Patterns in TypeScript Reference

Production implementations of essential design patterns in full-stack TypeScript.

---

## 1. Adapter Pattern (Dependency Isolation)

```typescript
// 1. Domain Interface (Owned by the application)
export interface IEmailAdapter {
  send(to: string, subject: string, html: string): Promise<Result<void, Error>>;
}

// 2. Open-Source Infrastructure Implementation (e.g. Mailpit/Nodemailer)
export class NodemailerEmailAdapter implements IEmailAdapter {
  constructor(private readonly transporter: nodemailer.Transporter) {}

  async send(to: string, subject: string, html: string): Promise<Result<void, Error>> {
    try {
      await this.transporter.sendMail({ to, subject, html });
      return { success: true, value: undefined };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
}
```

---

## 2. Strategy Pattern (Runtime Policy Swapping)

```typescript
// 1. Strategy Contract
export interface ITenantPricingStrategy {
  calculateMonthlyRate(activeSeats: number): number;
}

// 2. Concrete Strategies
export class StandardPricingStrategy implements ITenantPricingStrategy {
  calculateMonthlyRate(activeSeats: number): number {
    return activeSeats * 15;
  }
}

export class EnterprisePricingStrategy implements ITenantPricingStrategy {
  calculateMonthlyRate(activeSeats: number): number {
    return activeSeats * 10 + 500; // Flat base fee
  }
}
```

---

## 3. Result / Either Pattern (Type-Safe Errors)

```typescript
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ success: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });
```
