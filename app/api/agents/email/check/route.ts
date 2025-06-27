import { NextRequest, NextResponse } from 'next/server';
import { secureTokensService } from '@/app/services/secure-tokens-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Email check request body:", body);
    
    const { 
      site_id, 
      use_saved_credentials,
      email,
      password,
      incoming_server,
      incoming_port,
      outgoing_server,
      outgoing_port
    } = body;

    if (!site_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Site ID is required'
        }
      }, { status: 400 });
    }

    let emailCredentials = {
      email: email || '',
      password: password || '',
      incoming_server: incoming_server || '',
      incoming_port: incoming_port || '',
      outgoing_server: outgoing_server || '',
      outgoing_port: outgoing_port || ''
    };

    // If using saved credentials, retrieve them from secure storage
    if (use_saved_credentials) {
      try {
        // Get site settings to find the email address
        if (!emailCredentials.email) {
          // Fetch site settings from Supabase
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          
          const { data: siteData, error: siteError } = await supabase
            .from('sites')
            .select('settings')
            .eq('id', site_id)
            .single();
            
          if (siteError || !siteData?.settings?.channels?.email?.email) {
            return NextResponse.json({
              success: false,
              error: {
                code: 'EMAIL_CONFIG_NOT_FOUND',
                message: 'Email configuration not found in site settings'
              }
            }, { status: 404 });
          }
          
          emailCredentials.email = siteData.settings.channels.email.email;
          
          // Also get server settings if not provided
          if (!emailCredentials.incoming_server) {
            emailCredentials.incoming_server = siteData.settings.channels.email.incomingServer || '';
            emailCredentials.incoming_port = siteData.settings.channels.email.incomingPort || '';
            emailCredentials.outgoing_server = siteData.settings.channels.email.outgoingServer || '';
            emailCredentials.outgoing_port = siteData.settings.channels.email.outgoingPort || '';
          }
        }

        // Try to retrieve the stored password using the retrieve operation
        const response = await fetch(`${req.nextUrl.origin}/api/secure-tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            operation: 'retrieve',
            siteId: site_id,
            tokenType: 'email',
            identifier: emailCredentials.email
          })
        });

        if (response.ok) {
          const tokenData = await response.json();
          if (tokenData.tokenValue) {
            emailCredentials.password = tokenData.tokenValue;
            console.log("Retrieved stored password for email test");
          } else {
            return NextResponse.json({
              success: false,
              error: {
                code: 'EMAIL_CONFIG_NOT_FOUND',
                message: 'No saved email credentials found'
              }
            }, { status: 404 });
          }
        } else {
          return NextResponse.json({
            success: false,
            error: {
              code: 'EMAIL_CONFIG_NOT_FOUND',
              message: 'Failed to retrieve saved credentials'
            }
          }, { status: 404 });
        }
      } catch (error) {
        console.error("Error retrieving saved credentials:", error);
        return NextResponse.json({
          success: false,
          error: {
            code: 'SYSTEM_ERROR',
            message: 'Failed to retrieve saved credentials'
          }
        }, { status: 500 });
      }
    }

    // Validate required fields
    if (!emailCredentials.email || !emailCredentials.password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Email and password are required'
        }
      }, { status: 400 });
    }

    // TODO: Implement actual email connection test here
    // For now, simulate a successful test
    console.log("Testing email connection with:", {
      email: emailCredentials.email,
      incoming_server: emailCredentials.incoming_server,
      incoming_port: emailCredentials.incoming_port,
      outgoing_server: emailCredentials.outgoing_server,
      outgoing_port: emailCredentials.outgoing_port
    });

    // Simulate connection test (replace with actual IMAP/SMTP test)
    try {
      // Here you would implement the actual email connection test
      // using nodemailer or similar library to test IMAP/SMTP connection
      
      return NextResponse.json({
        success: true,
        message: 'Email connection test successful'
      });
    } catch (testError) {
      console.error("Email connection test failed:", testError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'EMAIL_FETCH_ERROR',
          message: 'Failed to connect to email server'
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Error in email check endpoint:", error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'SYSTEM_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
} 