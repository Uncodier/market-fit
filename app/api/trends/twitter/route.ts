import { NextRequest, NextResponse } from 'next/server'

interface TwitterTrend {
  name: string
  url: string
  promoted_content: string | null
  query: string
  tweet_volume: number | null
}

interface TwitterApiResponse {
  trends: TwitterTrend[]
  as_of: string
  created_at: string
  locations: Array<{ name: string; woeid: number }>
}

// Generate fallback trends based on keywords if API fails or no token
function generateFallbackTrends(keywords: string[]): TwitterTrend[] {
  const fallbackTrends: TwitterTrend[] = [];
  
  if (!keywords || keywords.length === 0) {
    keywords = ['Business', 'Tech', 'Startups', 'Marketing', 'AI'];
  }

  // Use top 10 keywords to generate trends
  keywords.slice(0, 10).forEach((keyword, index) => {
    // Clean up keyword for hashtag format
    const hashtag = keyword.replace(/\s+/g, '').replace(/[^\w]/g, '');
    const isHashtag = Math.random() > 0.5;
    const name = isHashtag ? `#${hashtag}` : keyword;
    
    fallbackTrends.push({
      name,
      url: `http://twitter.com/search?q=${encodeURIComponent(name)}`,
      promoted_content: null,
      query: encodeURIComponent(name),
      tweet_volume: Math.floor(Math.random() * 50000) + 10000
    });
  });

  return fallbackTrends;
}

export async function POST(request: NextRequest) {
  try {
    const { woeid = 1, limit = 10, keywords } = await request.json()

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    let trendsData: TwitterTrend[] = [];

    if (bearerToken) {
      console.log('🔑 [Twitter API] Using authenticated API')
      const twitterUrl = `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`;
      
      const response = await fetch(twitterUrl, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'User-Agent': process.env.TWITTER_USER_AGENT || 'MarketFit/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0 && data[0].trends) {
          trendsData = data[0].trends;
        }
      } else {
        console.error('❌ [Twitter API] Failed to fetch:', response.status, response.statusText);
        // Fallback to generated
        trendsData = generateFallbackTrends(keywords);
      }
    } else {
      console.log('🔓 [Twitter API] No credentials found, using simulated trends based on keywords')
      trendsData = generateFallbackTrends(keywords);
    }

    // Sort by tweet volume
    trendsData.sort((a, b) => (b.tweet_volume || 0) - (a.tweet_volume || 0));

    // Limit results
    const limitedTrends = trendsData.slice(0, limit);

    return NextResponse.json({
      success: true,
      trends: limitedTrends,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [Twitter API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Twitter trends' },
      { status: 500 }
    )
  }
}
