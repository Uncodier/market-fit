#!/usr/bin/env node

/**
 * Script to revert task type validations back to strict enum
 * This will restore the original z.enum() validation for task types
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Starting task type reversion script...');

// Files to revert
const filesToRevert = [
  'app/leads/tasks/actions.ts',
  'app/tasks/types.ts'
];

// Revert function using backups
function revertFromBackup(filePath) {
  const backupPath = `${filePath}.backup`;
  
  if (!fs.existsSync(backupPath)) {
    console.log(`❌ No backup found for: ${filePath}`);
    return false;
  }
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Original file not found: ${filePath}`);
    return false;
  }
  
  try {
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    console.log(`✅ Reverted: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error reverting ${filePath}:`, error.message);
    return false;
  }
}

// Manual revert function (if backups don't exist)
function manualRevertTaskActions() {
  const filePath = 'app/leads/tasks/actions.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace flexible string validation back to strict enum
  const flexibleTypeValidation = `type: z.string().min(1, "Type is required"),`;
  
  const strictTypeValidation = `type: z.enum([
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
  
  content = content.replace(flexibleTypeValidation, strictTypeValidation);
  
  // Update the TypeScript interface back to enum
  const flexibleTypeInterface = /type: string/g;
  const strictTypeInterface = `type: "website_visit" | "demo" | "meeting" | "email" | "call" | "quote" | "contract" | "payment" | "referral" | "feedback"`;
  
  content = content.replace(flexibleTypeInterface, strictTypeInterface);
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Manually reverted: ${filePath}`);
  return true;
}

// Manual revert for types file
function manualRevertTaskTypes() {
  const filePath = 'app/tasks/types.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove the comment we added
  content = content.replace(/ \/\/ Now accepts any string value/g, '');
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Manually reverted: ${filePath}`);
  return true;
}

// Main execution
function main() {
  try {
    console.log('📝 This script will revert task type validations back to strict enum\n');
    
    let success = true;
    let usedBackups = false;
    
    // Try to revert using backups first
    for (const filePath of filesToRevert) {
      const backupPath = `${filePath}.backup`;
      if (fs.existsSync(backupPath)) {
        success = revertFromBackup(filePath) && success;
        usedBackups = true;
      }
    }
    
    // If no backups were found, try manual revert
    if (!usedBackups) {
      console.log('ℹ️  No backups found, attempting manual revert...\n');
      success = manualRevertTaskActions() && success;
      success = manualRevertTaskTypes() && success;
    }
    
    if (success) {
      console.log('\n✅ Reversion completed successfully!');
      console.log('\n📋 Summary of changes:');
      console.log('   • Task type validation reverted to strict enum');
      console.log('   • TypeScript interfaces reverted to union types');
      console.log('   • Original validation rules restored');
      console.log('\n⚠️  Note:');
      console.log('   • Any tasks created with custom types may cause validation errors');
      console.log('   • You may need to update existing tasks with custom types');
    } else {
      console.log('\n❌ Reversion completed with errors. Check the logs above.');
    }
    
  } catch (error) {
    console.error('💥 Error running reversion script:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  revertFromBackup,
  manualRevertTaskActions,
  manualRevertTaskTypes
}; 