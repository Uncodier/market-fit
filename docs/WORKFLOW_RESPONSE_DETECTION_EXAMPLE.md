# Workflow Response Detection Implementation Example

## Overview

This document provides implementation examples for detecting responses in lead follow-up workflows and immediately notifying the main application via webhook instead of waiting 2 hours.

## Lead Follow-Up Workflow Implementation

### 1. Email Response Detection

```python
import asyncio
import aiohttp
import imaplib
import email
from datetime import datetime
import json

class LeadFollowUpWorkflow:
    def __init__(self, frontend_url: str, email_config: dict):
        self.frontend_url = frontend_url
        self.email_config = email_config
        self.webhook_url = f"{frontend_url}/api/workflows/webhook"
    
    async def execute_follow_up(self, lead_id: str, site_id: str, user_id: str, lead_email: str):
        """Execute lead follow-up workflow with real-time response detection"""
        
        # Step 1: Send follow-up email
        await self.send_follow_up_email(lead_email, lead_id)
        
        # Step 2: Monitor for responses (instead of waiting 2 hours)
        response_detected = await self.monitor_email_responses(
            lead_email, 
            lead_id, 
            site_id, 
            user_id,
            timeout_minutes=120  # Still have a timeout, but monitor actively
        )
        
        if response_detected:
            print(f"✅ Lead {lead_id} responded! Webhook sent immediately.")
            return {"status": "success", "response_time": "immediate"}
        else:
            print(f"⏰ No response from lead {lead_id} after 2 hours")
            return {"status": "timeout", "response_time": "2_hours"}
    
    async def monitor_email_responses(self, lead_email: str, lead_id: str, 
                                    site_id: str, user_id: str, timeout_minutes: int = 120):
        """Monitor email inbox for responses from the lead"""
        
        start_time = datetime.now()
        check_interval = 30  # Check every 30 seconds
        
        while (datetime.now() - start_time).seconds < (timeout_minutes * 60):
            try:
                # Check for new emails from the lead
                response = await self.check_inbox_for_lead_response(lead_email)
                
                if response:
                    # Found a response! Send webhook immediately
                    await self.send_response_webhook(
                        lead_id=lead_id,
                        site_id=site_id,
                        user_id=user_id,
                        response_data={
                            "message": "Lead responded to follow-up email",
                            "response_type": "email",
                            "response_content": response["content"][:500],  # First 500 chars
                            "timestamp": response["timestamp"]
                        }
                    )
                    return True
                
                # Wait before checking again
                await asyncio.sleep(check_interval)
                
            except Exception as e:
                print(f"Error monitoring email responses: {e}")
                await asyncio.sleep(check_interval)
        
        return False
    
    async def check_inbox_for_lead_response(self, lead_email: str):
        """Check email inbox for responses from specific lead"""
        try:
            # Connect to IMAP server
            mail = imaplib.IMAP4_SSL(self.email_config["imap_server"])
            mail.login(self.email_config["email"], self.email_config["password"])
            mail.select('inbox')
            
            # Search for emails from the lead in the last 5 minutes
            search_criteria = f'(FROM "{lead_email}" SINCE "{datetime.now().strftime("%d-%b-%Y")}")'
            result, data = mail.search(None, search_criteria)
            
            if data[0]:
                email_ids = data[0].split()
                
                # Check the most recent emails
                for email_id in email_ids[-5:]:  # Check last 5 emails
                    result, email_data = mail.fetch(email_id, '(RFC822)')
                    raw_email = email_data[0][1]
                    email_message = email.message_from_bytes(raw_email)
                    
                    # Get email timestamp
                    email_date = email.utils.parsedate_to_datetime(email_message['Date'])
                    
                    # Check if this email is recent (within last 5 minutes)
                    time_diff = (datetime.now(email_date.tzinfo) - email_date).total_seconds()
                    
                    if time_diff <= 300:  # 5 minutes
                        # Extract email content
                        content = self.extract_email_content(email_message)
                        
                        mail.close()
                        mail.logout()
                        
                        return {
                            "content": content,
                            "timestamp": email_date.isoformat(),
                            "subject": email_message.get('Subject', '')
                        }
            
            mail.close()
            mail.logout()
            return None
            
        except Exception as e:
            print(f"Error checking inbox: {e}")
            return None
    
    def extract_email_content(self, email_message):
        """Extract text content from email message"""
        content = ""
        
        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    content = part.get_payload(decode=True).decode('utf-8')
                    break
        else:
            content = email_message.get_payload(decode=True).decode('utf-8')
        
        return content
    
    async def send_response_webhook(self, lead_id: str, site_id: str, 
                                  user_id: str, response_data: dict):
        """Send webhook notification when response is detected"""
        
        webhook_payload = {
            "workflow_type": "leadFollowUp",
            "event_type": "response_received",
            "lead_id": lead_id,
            "site_id": site_id,
            "user_id": user_id,
            "response_data": response_data
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=webhook_payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        print(f"✅ Webhook sent successfully: {result}")
                        return True
                    else:
                        error_text = await response.text()
                        print(f"❌ Webhook failed with status {response.status}: {error_text}")
                        return False
                        
        except Exception as e:
            print(f"❌ Error sending webhook: {e}")
            return False
    
    async def send_follow_up_email(self, lead_email: str, lead_id: str):
        """Send the actual follow-up email"""
        # Implementation depends on your email service
        # This is just a placeholder
        print(f"📧 Sending follow-up email to {lead_email} for lead {lead_id}")
        # Your email sending logic here
        pass
```

### 2. Phone Call Response Detection

```python
class PhoneCallResponseDetection:
    def __init__(self, frontend_url: str, twilio_config: dict):
        self.frontend_url = frontend_url
        self.twilio_config = twilio_config
        self.webhook_url = f"{frontend_url}/api/workflows/webhook"
    
    async def monitor_call_response(self, phone_number: str, lead_id: str, 
                                  site_id: str, user_id: str):
        """Monitor for call pickup/response using Twilio webhooks"""
        
        # Set up Twilio webhook to detect call status changes
        call_status_webhook = f"{self.api_base_url}/webhook/call-status/{lead_id}"
        
        # Make the call with status callback
        call = self.twilio_client.calls.create(
            to=phone_number,
            from_=self.twilio_config["phone_number"],
            url=self.get_twiml_url(),
            status_callback=call_status_webhook,
            status_callback_event=['answered', 'completed']
        )
        
        print(f"📞 Call initiated to {phone_number}, monitoring for pickup...")
        return call.sid
    
    async def handle_call_status_webhook(self, lead_id: str, call_status: str, 
                                       site_id: str, user_id: str):
        """Handle Twilio webhook when call status changes"""
        
        if call_status == 'answered':
            # Call was answered! Send immediate webhook
            await self.send_response_webhook(
                lead_id=lead_id,
                site_id=site_id,
                user_id=user_id,
                response_data={
                    "message": "Lead answered follow-up call",
                    "response_type": "call",
                    "response_content": "Call was answered by lead",
                    "timestamp": datetime.now().isoformat()
                }
            )
```

### 3. Meeting Booking Response Detection

```python
class MeetingBookingResponseDetection:
    def __init__(self, frontend_url: str, calendar_config: dict):
        self.frontend_url = frontend_url
        self.calendar_config = calendar_config
        self.webhook_url = f"{frontend_url}/api/workflows/webhook"
    
    async def monitor_calendar_booking(self, booking_link: str, lead_id: str, 
                                     site_id: str, user_id: str):
        """Monitor calendar booking system for new meetings"""
        
        # This depends on your calendar system (Calendly, Google Calendar, etc.)
        # Example with polling approach
        
        start_time = datetime.now()
        while (datetime.now() - start_time).seconds < 7200:  # 2 hours
            
            # Check for new bookings
            new_booking = await self.check_new_bookings(lead_id)
            
            if new_booking:
                await self.send_response_webhook(
                    lead_id=lead_id,
                    site_id=site_id,
                    user_id=user_id,
                    response_data={
                        "message": "Lead booked a meeting",
                        "response_type": "meeting",
                        "response_content": f"Meeting scheduled for {new_booking['time']}",
                        "timestamp": new_booking['timestamp']
                    }
                )
                return True
            
            await asyncio.sleep(60)  # Check every minute
        
        return False
```

### 4. Multi-Channel Response Detection

```python
class MultiChannelResponseDetection:
    def __init__(self, frontend_url: str, configs: dict):
        self.frontend_url = frontend_url
        self.configs = configs
        self.webhook_url = f"{frontend_url}/api/workflows/webhook"
        
        # Initialize different monitoring systems
        self.email_monitor = EmailResponseMonitor(configs['email'])
        self.phone_monitor = PhoneCallResponseDetection(frontend_url, configs['twilio'])
        self.meeting_monitor = MeetingBookingResponseDetection(frontend_url, configs['calendar'])
    
    async def monitor_all_channels(self, lead_data: dict):
        """Monitor all communication channels simultaneously"""
        
        tasks = []
        
        # Email monitoring
        if lead_data.get('email'):
            tasks.append(
                self.email_monitor.monitor_email_responses(
                    lead_data['email'],
                    lead_data['lead_id'],
                    lead_data['site_id'],
                    lead_data['user_id']
                )
            )
        
        # Phone monitoring
        if lead_data.get('phone'):
            tasks.append(
                self.phone_monitor.monitor_call_response(
                    lead_data['phone'],
                    lead_data['lead_id'],
                    lead_data['site_id'],
                    lead_data['user_id']
                )
            )
        
        # Meeting booking monitoring
        if lead_data.get('booking_link'):
            tasks.append(
                self.meeting_monitor.monitor_calendar_booking(
                    lead_data['booking_link'],
                    lead_data['lead_id'],
                    lead_data['site_id'],
                    lead_data['user_id']
                )
            )
        
        # Wait for any response
        if tasks:
            done, pending = await asyncio.wait(
                tasks, 
                return_when=asyncio.FIRST_COMPLETED,
                timeout=7200  # 2 hours timeout
            )
            
            # Cancel remaining tasks if one completed
            for task in pending:
                task.cancel()
            
            # Check if any task completed successfully
            for task in done:
                try:
                    result = await task
                    if result:
                        return True
                except Exception as e:
                    print(f"Error in monitoring task: {e}")
        
        return False
```

## Integration Example

```python
# Main workflow execution
async def execute_lead_follow_up_workflow(lead_data: dict):
    """Main function to execute lead follow-up with immediate response detection"""
    
    workflow = LeadFollowUpWorkflow(
        frontend_url=FRONTEND_URL,
        email_config=EMAIL_CONFIG
    )
    
    print(f"🚀 Starting follow-up workflow for lead {lead_data['lead_id']}")
    
    # Execute workflow with real-time monitoring
    result = await workflow.execute_follow_up(
        lead_id=lead_data['lead_id'],
        site_id=lead_data['site_id'],
        user_id=lead_data['user_id'],
        lead_email=lead_data['email']
    )
    
    if result['response_time'] == 'immediate':
        print("✅ SUCCESS: Lead responded immediately, webhook sent!")
    else:
        print("⏰ TIMEOUT: No response received within 2 hours")
    
    return result

# Usage
lead_data = {
    "lead_id": "uuid-here",
    "site_id": "uuid-here", 
    "user_id": "uuid-here",
    "email": "lead@example.com",
    "phone": "+1234567890"
}

result = await execute_lead_follow_up_workflow(lead_data)
```

## Key Benefits

1. **Immediate Response**: No more 2-hour waits
2. **Real-time Notifications**: Users get instant feedback
3. **Multi-channel Monitoring**: Email, phone, meetings all tracked
4. **Robust Error Handling**: Failures don't break the workflow
5. **Scalable Architecture**: Can handle multiple leads simultaneously

## Implementation Notes

- Use async/await for non-blocking monitoring
- Implement proper error handling and retries
- Log all response detection events
- Consider rate limiting for external API calls
- Use connection pooling for better performance 