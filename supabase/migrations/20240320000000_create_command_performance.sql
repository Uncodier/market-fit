-- Create command_performance table
CREATE TABLE IF NOT EXISTS command_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    command_id UUID NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    flags INTEGER DEFAULT 0,
    user_vote TEXT CHECK (user_vote IN ('like', 'dislike', NULL)),
    user_flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(command_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_command_performance_command_id ON command_performance(command_id);
CREATE INDEX IF NOT EXISTS idx_command_performance_user_id ON command_performance(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_command_performance_updated_at
    BEFORE UPDATE ON command_performance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE command_performance ENABLE ROW LEVEL SECURITY;

-- Policy for selecting
CREATE POLICY "Users can view all command performance"
    ON command_performance FOR SELECT
    TO authenticated
    USING (true);

-- Policy for inserting/updating
CREATE POLICY "Users can update their own command performance"
    ON command_performance FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id); 