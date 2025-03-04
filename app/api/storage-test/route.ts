import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Test if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      return NextResponse.json({ error: 'Authentication error', details: authError }, { status: 401 });
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // List all available buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return NextResponse.json({ error: 'Error listing buckets', details: bucketsError }, { status: 500 });
    }
    
    // For each bucket, try to list files and test permissions
    const bucketResults = [];
    
    for (const bucket of buckets) {
      try {
        // Try to list files in the bucket root
        const { data: files, error: listError } = await supabase.storage.from(bucket.name).list();
        
        // Try to create a test folder
        const testFolderName = `test-${Date.now()}`;
        const { error: createFolderError } = await supabase.storage.from(bucket.name)
          .upload(`${testFolderName}/.emptyfile`, new Uint8Array(0));
        
        // Check RLS policies
        const isPublic = bucket.public;
        const canList = !listError;
        const canCreate = !createFolderError;
        
        bucketResults.push({
          name: bucket.name,
          isPublic,
          canList,
          canCreate,
          listError: listError ? listError.message : null,
          createError: createFolderError ? createFolderError.message : null,
          fileCount: files?.length || 0,
        });
        
        // Clean up test folder if it was created
        if (!createFolderError) {
          await supabase.storage.from(bucket.name).remove([`${testFolderName}/.emptyfile`]);
        }
      } catch (err: any) {
        bucketResults.push({
          name: bucket.name,
          error: err.message || 'Unknown error',
        });
      }
    }
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      buckets: bucketResults
    });
  } catch (error: any) {
    console.error('Storage test error:', error);
    return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
} 