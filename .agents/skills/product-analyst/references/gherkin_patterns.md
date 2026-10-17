# Gherkin Scenario Patterns Reference

Reusable Gherkin acceptance criteria patterns for full-stack and API features.

---

## 1. REST API CRUD Pattern
```gherkin
Scenario: Successfully creating a tenant resource
  Given an authenticated user with role "ADMIN" in tenant "tenant-123"
  When the user sends a "POST" request to "/api/roles" with payload:
    """
    {
      "name": "Editor",
      "description": "Content editor role"
    }
    """
  Then the response status should be 201
  And the response body should contain the generated "id"
  And the role should be persisted in tenant "tenant-123"
```

---

## 2. Multi-Tenant Isolation Pattern
```gherkin
Scenario: Tenant data isolation violation attempt
  Given an authenticated user in tenant "tenant-A"
  When the user sends a "GET" request to "/api/members" with header "X-Tenant-ID: tenant-B"
  Then the response status should be 403
  And the response code should be "FORBIDDEN_TENANT_ACCESS"
  And a security audit event should be recorded
```

---

## 3. UI Interaction & Validation Pattern
```gherkin
Scenario: Submitting an invalid email address
  Given the user is on the login page
  When the user enters "invalid-email" into the email input
  And clicks the "Sign In" button
  Then an alert message "Invalid email address format" should appear
  And the email input should have "aria-invalid" set to "true"
  And no network request should be dispatched to the server
```
