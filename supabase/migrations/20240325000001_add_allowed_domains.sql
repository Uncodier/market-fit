-- Create allowed_domains table with RLS policies
create table public.allowed_domains (
    id uuid default gen_random_uuid() primary key,
    site_id uuid not null references public.sites(id) on delete cascade,
    domain text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    -- Ensure domain format is valid and unique per site
    -- Allow regular domains, localhost, and IP addresses (both IPv4 and IPv6)
    constraint valid_domain check (
        domain = 'localhost' OR  -- Allow localhost
        domain ~* '^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$' OR  -- Regular domains
        domain ~* '^(\d{1,3}\.){3}\d{1,3}$' OR  -- IPv4
        domain ~* '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$'  -- IPv6
    ),
    constraint unique_domain_per_site unique (site_id, domain)
);

-- Add indexes
create index allowed_domains_site_id_idx on public.allowed_domains(site_id);
create index allowed_domains_domain_idx on public.allowed_domains(domain);

-- Enable RLS
alter table public.allowed_domains enable row level security;

-- Create RLS policies
create policy "Users can view allowed domains for their sites"
    on public.allowed_domains for select
    using (
        site_id in (
            select s.id 
            from public.sites s
            left join public.site_members sm on s.id = sm.site_id
            left join public.site_ownership so on s.id = so.site_id
            where sm.user_id = auth.uid() or so.user_id = auth.uid()
        )
    );

create policy "Only owners and admins can insert allowed domains"
    on public.allowed_domains for insert
    with check (
        site_id in (
            select s.id 
            from public.sites s
            left join public.site_members sm on s.id = sm.site_id
            left join public.site_ownership so on s.id = so.site_id
            where (sm.user_id = auth.uid() and sm.role = 'admin') 
               or so.user_id = auth.uid()
        )
    );

create policy "Only owners and admins can update allowed domains"
    on public.allowed_domains for update
    using (
        site_id in (
            select s.id 
            from public.sites s
            left join public.site_members sm on s.id = sm.site_id
            left join public.site_ownership so on s.id = so.site_id
            where (sm.user_id = auth.uid() and sm.role = 'admin') 
               or so.user_id = auth.uid()
        )
    )
    with check (
        site_id in (
            select s.id 
            from public.sites s
            left join public.site_members sm on s.id = sm.site_id
            left join public.site_ownership so on s.id = so.site_id
            where (sm.user_id = auth.uid() and sm.role = 'admin') 
               or so.user_id = auth.uid()
        )
    );

create policy "Only owners and admins can delete allowed domains"
    on public.allowed_domains for delete
    using (
        site_id in (
            select s.id 
            from public.sites s
            left join public.site_members sm on s.id = sm.site_id
            left join public.site_ownership so on s.id = so.site_id
            where (sm.user_id = auth.uid() and sm.role = 'admin') 
               or so.user_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

-- Create trigger to automatically update updated_at
create trigger handle_allowed_domains_updated_at
    before update on public.allowed_domains
    for each row
    execute function public.handle_updated_at();

-- Add comment to table
comment on table public.allowed_domains is 'Table storing allowed domains for CORS per site';

-- Insert some common domains by default for development
insert into public.allowed_domains (site_id, domain)
select 
    s.id,
    'localhost'
from 
    public.sites s; 