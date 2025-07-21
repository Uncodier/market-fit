# Workflow Webhook Integration

## Overview

This document describes the webhook integration system that allows the external API server to notify the main application when workflows detect responses or complete their execution. This system eliminates the 2-hour waiting period for lead follow-up workflows by providing real-time notifications.

## Webhook Endpoint

**URL:** `{FRONTEND_URL}/api/workflows/webhook`
**Method:** `POST`
**Content-Type:** `application/json`

## Authentication

The webhook uses Supabase service role authentication. No additional headers are required as the endpoint uses elevated permissions to process notifications.

## Payload Schema

```typescript
interface WorkflowWebhookPayload {
  workflow_type: 'leadFollowUp' | 'leadResearch' | 'syncEmails' | 'dailyStandUp' | 'leadGeneration' | 'assignLeads';
  event_type: 'response_received' | 'workflow_completed' | 'workflow_failed';
  lead_id: string; // UUID
  site_id: string; // UUID  
  user_id: string; // UUID
  response_data?: {
    message?: string;
    response_type?: string; // 'email', 'call', 'meeting', etc.
    response_content?: string;
    timestamp?: string; // ISO string
  };
  metadata?: Record<string, any>;
}
```

## Event Types

### 1. `response_received`
Triggered when a lead responds to a workflow (especially for `leadFollowUp`).

**Special Handling for `leadFollowUp`:**
- Creates a completed follow-up task
- Sends immediate success notification to user
- Updates lead status from 'new' to 'contacted' if applicable
- Moves lead to 'consideration' stage in journey

### 2. `workflow_completed`
Triggered when any workflow completes successfully.

### 3. `workflow_failed`
Triggered when any workflow fails or encounters an error.

## Implementation Examples

### Lead Follow-Up Response Detected

```javascript
// When your leadFollowUp workflow detects a response
const webhookPayload = {
  workflow_type: 'leadFollowUp',
  event_type: 'response_received',
  lead_id: 'lead-uuid-here',
  site_id: 'site-uuid-here', 
  user_id: 'user-uuid-here',
  response_data: {
    message: 'Lead responded to follow-up email',
    response_type: 'email',
    response_content: 'Thanks for reaching out! I\'m interested in learning more.',
    timestamp: new Date().toISOString()
  }
};

await fetch(`${FRONTEND_URL}/api/workflows/webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(webhookPayload)
});
```

### Workflow Completion

```javascript
// When any workflow completes
const webhookPayload = {
  workflow_type: 'leadResearch',
  event_type: 'workflow_completed',
  lead_id: 'lead-uuid-here',
  site_id: 'site-uuid-here',
  user_id: 'user-uuid-here',
  metadata: {
    duration_ms: 45000,
    research_points: 12,
    confidence_score: 0.85
  }
};

await fetch(`${FRONTEND_URL}/api/workflows/webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(webhookPayload)
});
```

### Workflow Failure

```javascript
// When a workflow fails
const webhookPayload = {
  workflow_type: 'leadFollowUp',
  event_type: 'workflow_failed',
  lead_id: 'lead-uuid-here',
  site_id: 'site-uuid-here',
  user_id: 'user-uuid-here',
  metadata: {
    error_type: 'email_delivery_failed',
    error_message: 'SMTP server rejected recipient',
    retry_count: 3
  }
};

await fetch(`${FRONTEND_URL}/api/workflows/webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(webhookPayload)
});
```

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "message": "Follow-up response processed successfully",
  "data": {
    "lead_id": "lead-uuid-here",
    "task_created": true,
    "notification_sent": true,
    "lead_status_updated": true
  }
}
```

### Error Response (400/404/500)

```json
{
  "error": "Lead not found",
  "details": "No lead found with the provided ID and site ID"
}
```

## Integration Guidelines

### 1. Response Detection in Lead Follow-Up

The most critical integration is detecting when a lead responds to a follow-up. Your workflow should:

- Monitor email responses, calls answered, meetings scheduled, etc.
- Immediately call the webhook with `event_type: 'response_received'`
- Include relevant response details in `response_data`

### 2. Error Handling

- Implement retry logic for webhook calls (max 3 retries with exponential backoff)
- Log webhook failures for debugging
- Continue workflow execution even if webhook fails

### 3. Performance Considerations

- Make webhook calls asynchronous to avoid blocking workflow execution
- Use connection pooling for HTTP requests
- Set reasonable timeouts (5-10 seconds)

## Testing

You can test the webhook endpoint:

```bash
# Test endpoint availability
curl -X GET {FRONTEND_URL}/api/workflows/webhook

# Test with sample payload
curl -X POST {FRONTEND_URL}/api/workflows/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_type": "leadFollowUp",
    "event_type": "response_received", 
    "lead_id": "test-lead-uuid",
    "site_id": "test-site-uuid",
    "user_id": "test-user-uuid",
    "response_data": {
      "message": "Test response",
      "response_type": "email",
      "response_content": "This is a test response"
    }
  }'
```

## Benefits

1. **Immediate Feedback**: Users get instant notifications when leads respond
2. **Accurate Journey Tracking**: Lead stages update in real-time
3. **Better UX**: No more 2-hour waiting periods
4. **Automated Status Updates**: Lead statuses change automatically based on responses
5. **Comprehensive Logging**: All workflow events are tracked and recorded

## Migration Notes

For existing workflows:
1. Update your response detection logic to call this webhook
2. Remove or reduce timeout periods since responses are now handled immediately
3. Test thoroughly with real email/communication channels
4. Monitor webhook success rates and implement proper error handling 