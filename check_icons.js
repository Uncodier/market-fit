const fs = require('fs');
const glob = require('glob');

const icons = [
'Menu', 'Loader', 'SaveIcon', 'Globe', 'Database', 'Settings', 'Bell', 'Shield', 'HelpCircle', 'LogIn', 'LogOut', 'Check', 'ChevronDown', 'ChevronUp', 'ChevronRight', 'ChevronLeft', 'Search', 'PlusCircle', 'Filter', 'Download', 'UploadCloud', 'LayoutGrid', 'FlaskConical', 'ClipboardList', 'Users', 'User', 'MessageSquare', 'Home', 'FolderOpen', 'Eye', 'EyeOff', 'PlayCircle', 'PenSquare', 'StopCircle', 'XCircle', 'Copy', 'Trash2', 'ExternalLink', 'FileVideo', 'Video', 'FileText', 'Server', 'Circle', 'CalendarIcon', 'X', 'Pencil', 'AppWindow', 'Tag', 'Archive', 'RotateCcw', 'RotateCw', 'CheckCircle2', 'Ban', 'Beaker', 'Sun', 'Plus', 'MapPin', 'Moon', 'Phone', 'ShoppingCart', 'BarChart', 'Mail', 'PieChart', 'TrendingUp', 'ActivitySquare', 'TrendingDown', 'PanelLeftClose', 'PanelLeftOpen', 'Keyboard', 'Command', 'TableRows', 'AlertTriangle', 'Clock', 'AlertCircle', 'Wand2', 'Save', 'Sparkles', 'Code', 'Image', 'Link', 'Star', 'Rocket', 'Plug', 'Megaphone', 'Target', 'Type', 'CreditCard', 'DollarSign', 'Info', 'Lock', 'File', 'NetworkTree', 'ZoomIn', 'ZoomOut', 'Maximize', 'MoreVertical', 'ThumbsUp', 'ThumbsDown', 'Flag', 'Send', 'Printer', 'CheckSquare', 'Key', 'KeyRound', 'ShieldCheck', 'MoreHorizontal', 'UnlockKeyhole', 'Google', 'WhatsApp', 'Palette', 'Heart', 'Lightbulb', 'CheckCircle', 'ListTodo', 'Calendar', 'Bot', 'Speaker', 'ArrowRight', 'Play', 'Pause', 'MicroPause', 'MicroPlay', 'Sliders', 'Cpu', 'Zap', 'Unlink', 'Microscope', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'MessageCircle', 'Edit', 'Hash', 'PenTool', 'Building', 'BookOpen', 'Folder', 'Stethoscope', 'GraduationCap', 'Briefcase', 'Ticket', 'ArrowUpRight', 'MonitorSmartphone', 'DatabaseIcon', 'Workflow', 'Terminal', 'Reply', 'GripHorizontal', 'PanelRightClose', 'PanelRightOpen', 'Activity', 'Github', 'Store', 'GitFork', 'Monitor', 'Laptop', 'Tablet', 'Smartphone'
];

glob('app/**/*.tsx', (err, files) => {
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Non-greedy, don't match across </p>
    const regex = new RegExp(`<p(?:\\s+[^>]*>|>)(?:(?!</p>)[\\s\\S])*?<(${icons.join('|')})\\b(?:(?!</p>)[\\s\\S])*?</p>`, 'g');
    
    let match;
    while ((match = regex.exec(content)) !== null) {
      console.log(`Found in ${file}:\n${match[0]}\n`);
    }
  });
});
