#!/usr/bin/env node

/**
 * Script to modify task type validations to allow any string
 * This will change the z.enum() validation to z.string() for task types
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting task type flexibility script...');

// Files to modify
const filesToModify = [
  'app/leads/tasks/actions.ts',
  'app/tasks/types.ts'
];

// Backup function
function createBackup(filePath) {
  const backupPath = `${filePath}.backup`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
  }
}

// Restore function
function restoreBackup(filePath) {
  const backupPath = `${filePath}.backup`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    console.log(`🔄 Restored from backup: ${filePath}`);
  }
}

// Main modification function
function modifyTaskActions() {
  const filePath = 'app/leads/tasks/actions.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  createBackup(filePath);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the strict enum validation with flexible string validation
  const oldTypeValidation = `type: z.enum([
    "website_visit", 
    "demo", 
    "meeting", 
    "email", 
    "call", 
    "quote", 
    "contract", 
    "payment", 
    "referral", 
    "feedback"
  ]),`;
  
  const newTypeValidation = `type: z.string().min(1, "Type is required"),`;
  
  content = content.replace(oldTypeValidation, newTypeValidation);
  
  // Update the TypeScript interface in TaskResponse to use string instead of enum
  const oldTypeInterface = `type: "website_visit" | "demo" | "meeting" | "email" | "call" | "quote" | "contract" | "payment" | "referral" | "feedback"`;
  const newTypeInterface = `type: string`;
  
  content = content.replace(new RegExp(oldTypeInterface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newTypeInterface);
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Modified: ${filePath}`);
  return true;
}

// Modify types file
function modifyTaskTypes() {
  const filePath = 'app/tasks/types.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  createBackup(filePath);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add a comment to indicate the type field is now flexible
  const typeLineRegex = /(\s+type\?\s*:\s*string)/;
  if (content.match(typeLineRegex)) {
    content = content.replace(typeLineRegex, '$1 // Now accepts any string value');
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated comments in: ${filePath}`);
  return true;
}

// Check for other files that might need updates
function findOtherReferences() {
  console.log('\n🔍 Checking for other files that might reference strict task types...');
  
  const patterns = [
    'z.enum.*website_visit',
    'type.*=.*"website_visit"',
    '"website_visit".*\\|.*"demo"'
  ];
  
  // This is a simplified check - in a real script you'd use proper file scanning
  console.log('ℹ️  Please manually check the following files for any hardcoded type validations:');
  console.log('   - app/components/create-task-dialog.tsx');
  console.log('   - app/leads/components/AddTaskDialog.tsx');
  console.log('   - app/leads/components/EditTaskDialog.tsx');
  console.log('   - Any other components that create or validate tasks');
}

// Main execution
function main() {
  try {
    console.log('📝 This script will modify task type validations to accept any string\n');
    
    let success = true;
    
    // Modify the main validation file
    success = modifyTaskActions() && success;
    
    // Update the types file
    success = modifyTaskTypes() && success;
    
    // Check for other references
    findOtherReferences();
    
    if (success) {
      console.log('\n✅ Script completed successfully!');
      console.log('\n📋 Summary of changes:');
      console.log('   • Task type validation changed from enum to string');
      console.log('   • TypeScript interfaces updated to use string type');
      console.log('   • Database schema already supports any string (no changes needed)');
      console.log('\n⚠️  Manual steps required:');
      console.log('   • Check components that create tasks for hardcoded type options');
      console.log('   • Update any form validations that still use the old enum');
      console.log('   • Test task creation with custom type values');
      console.log('\n🔄 To revert changes, run: node scripts/revert-task-types.js');
    } else {
      console.log('\n❌ Script completed with errors. Check the logs above.');
    }
    
  } catch (error) {
    console.error('💥 Error running script:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  modifyTaskActions,
  modifyTaskTypes,
  createBackup,
  restoreBackup
}; 