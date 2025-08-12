# Database Sub-structures Documentation

This document details the JSONB structures used in various tables of the database.

## Instance Plans - Steps Structure

The `instance_plans.steps` field contains an array of step objects that define the individual steps within a plan.

### Structure

```json
{
  "steps": [
    {
      "id": "string", // Unique identifier for the step
      "title": "string", // Human-readable title of the step
      "description": "string", // Optional detailed description
      "status": "pending|in_progress|completed|failed", // Current status
      "order": number, // Optional ordering for display
      "tools_required": ["string"], // Optional array of tools needed
      "estimated_duration_minutes": number, // Optional time estimate
      "actual_duration_minutes": number, // Optional actual time taken
      "created_at": "ISO 8601 string", // Optional creation timestamp
      "completed_at": "ISO 8601 string", // Optional completion timestamp
      "error_message": "string", // Optional error details if failed
      "artifacts": ["string"] // Optional array of generated artifacts
    }
  ]
}
```

### Example

```json
{
  "steps": [
    {
      "id": "step-1",
      "title": "Navigate to website",
      "description": "Open the target website and wait for it to load",
      "status": "completed",
      "order": 1,
      "tools_required": ["computer"],
      "estimated_duration_minutes": 2,
      "actual_duration_minutes": 1,
      "created_at": "2024-12-19T10:00:00Z",
      "completed_at": "2024-12-19T10:01:00Z"
    },
    {
      "id": "step-2", 
      "title": "Fill out form",
      "description": "Complete the contact form with provided information",
      "status": "in_progress",
      "order": 2,
      "tools_required": ["computer", "edit"],
      "estimated_duration_minutes": 5,
      "created_at": "2024-12-19T10:01:00Z"
    },
    {
      "id": "step-3",
      "title": "Submit and verify",
      "description": "Submit the form and verify successful submission",
      "status": "pending",
      "order": 3,
      "tools_required": ["computer"],
      "estimated_duration_minutes": 3
    }
  ]
}
```

### Status Values

- `pending`: Step has not been started yet
- `in_progress`: Step is currently being executed
- `completed`: Step has been successfully completed
- `failed`: Step execution failed

### Real-time Updates

The steps field supports real-time updates through Supabase subscriptions. When a plan's steps are updated, the UI will automatically reflect the changes.

### Migration Notes

**IMPORTANT**: This structure replaces the previous `results` field which contained a more complex nested structure with phases. The new `steps` field provides a flatter, more direct representation of the execution steps.

#### Previous Structure (Deprecated)
```json
{
  "results": {
    "phases": [
      {
        "steps": [...]
      }
    ]
  }
}
```

#### New Structure
```json
{
  "steps": [...]
}
```

### Usage in Components

The steps are consumed by the `SimpleMessagesView` component which:

1. Loads steps from `instance_plans.steps` 
2. Displays them in a step indicator UI
3. Listens for real-time updates via Supabase subscriptions
4. Allows editing of step details through modals

### Database Constraints

- The `steps` field defaults to an empty array `[]`
- Each step object should have at minimum: `id`, `title`, and `status`
- Status values are validated at the application level
- Order values are used for display sorting but are not enforced at the database level