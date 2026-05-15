import re
import random
from datetime import datetime, timedelta

def generate_sales_and_costs(site_id, is_ecommerce):
    sales = []
    transactions = []
    
    now = datetime.now()
    
    if is_ecommerce:
        categories = ['Electronics', 'Clothing', 'Home', 'Beauty', 'Accessories']
        daily_sales_range = (5, 15)
        aov_range = (40, 150)
        
        cost_categories = ['advertising', 'content', 'freelance', 'hosting', 'utilities', 'salaries']
        daily_costs_range = (2, 5)
        cost_amount_range = (50, 500)
    else:
        categories = ['Enterprise', 'Team Plan', 'Starter Plan', 'API Access', 'Add-ons']
        daily_sales_range = (1, 4)
        aov_range = (500, 5000)
        
        cost_categories = ['software', 'hosting', 'salaries', 'marketing', 'agency', 'consulting']
        daily_costs_range = (1, 3)
        cost_amount_range = (200, 2000)
    
    for day_offset in range(180):
        current_date = now - timedelta(days=day_offset)
        date_str = current_date.isoformat() + 'Z'
        
        # Generate Sales
        num_sales = random.randint(*daily_sales_range)
        for i in range(num_sales):
            category = random.choice(categories)
            amount = random.uniform(*aov_range)
            source = 'online' if random.random() > 0.3 else 'retail'
            
            sales.append(f"""    {{
      id: 'sale-{site_id}-{day_offset}-{i}',
      site_id: '{site_id}',
      amount: {amount:.2f},
      currency: 'USD',
      status: 'completed',
      source: '{source}',
      product_category: '{category}',
      sale_date: '{current_date.strftime("%Y-%m-%d")}',
      created_at: '{date_str}',
      updated_at: '{date_str}'
    }}""")

        # Generate Transactions (Costs)
        num_costs = random.randint(*daily_costs_range)
        for i in range(num_costs):
            category = random.choice(cost_categories)
            amount = random.uniform(*cost_amount_range)
            cost_type = 'fixed' if random.random() > 0.6 else 'variable'
            
            transactions.append(f"""    {{
      id: 'tx-{site_id}-{day_offset}-{i}',
      site_id: '{site_id}',
      campaign_id: 'camp-{site_id}-1',
      type: '{cost_type}',
      amount: {amount:.2f},
      category: '{category}',
      date: '{current_date.strftime("%Y-%m-%d")}',
      created_at: '{date_str}',
      updated_at: '{date_str}',
      currency: 'USD'
    }}""")

    sales_str = ",\n  sales: [\n" + ",\n".join(sales) + "\n  ]"
    transactions_str = ",\n  transactions: [\n" + ",\n".join(transactions) + "\n  ]"
    
    return sales_str, transactions_str

def process_file(filename, site_id, is_ecommerce):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Remove existing sales and transactions if they exist
    content = re.sub(r",\s*sales:\s*\[.*?\](?=\s*,\s*[a-zA-Z_]+:|\s*};)", "", content, flags=re.DOTALL)
    content = re.sub(r",\s*transactions:\s*\[.*?\](?=\s*,\s*[a-zA-Z_]+:|\s*};)", "", content, flags=re.DOTALL)
    
    sales_str, transactions_str = generate_sales_and_costs(site_id, is_ecommerce)
    
    insertion_point = content.rfind('};')
    if insertion_point != -1:
        new_content = content[:insertion_point] + sales_str + transactions_str + "\n" + content[insertion_point:]
        with open(filename, 'w') as f:
            f.write(new_content)
        print(f"Updated {filename}")

if __name__ == "__main__":
    process_file('lib/demo-data/demo-ecom-es-456.ts', 'demo-ecom-es-456', True)
    process_file('lib/demo-data/demo-saas-en-123.ts', 'demo-saas-en-123', False)
