```text
auth-service | APP-55555 | Improve login failure handling

Why:
The ticket asks for better handling of failed sign-in attempts, but it does not fully specify the desired user or security behavior.

This change:
- Improve the handling of failed login attempts in the affected sign-in flow
- Preserve the current behavior for successful logins

Open questions:
- Should repeated failures lock the account, throttle requests, or only change the user-facing error response?
- Is the requested behavior limited to password login, or does it also include SSO login?
```
