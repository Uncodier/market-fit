import { NextRequest } from 'next/server';
import { GET } from './route';
import { NextResponse } from 'next/server';

// Mock dependencies
jest.mock('../../../lib/supabase/server-client', () => ({
  createApiClient: jest.fn()
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn().mockImplementation((body, options = {}) => ({
      status: options.status || 200,
      json: async () => body
    }))
  },
  NextRequest: jest.fn().mockImplementation((url) => ({
    url,
    nextUrl: new URL(url),
    headers: new Headers()
  }))
}));

// Import after mocking
import { createApiClient } from '../../../lib/supabase/server-client';

describe('Revenue API', () => {
  // Setup mock date for consistent testing
  const mockDate = new Date('2023-01-15T12:00:00Z');
  const originalDate = global.Date;

  beforeAll(() => {
    // Mock date
    global.Date = class extends originalDate {
      constructor() {
        super();
        return mockDate;
      }
    } as DateConstructor;
  });

  afterAll(() => {
    global.Date = originalDate;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create request mock
  const createRequestMock = (url: string) => {
    return new NextRequest(url);
  };

  it('should return existing KPI data if found', async () => {
    // Mock KPI data
    const mockKpi = {
      id: '123',
      name: 'Total Revenue',
      value: 5000,
      previous_value: 4000,
      trend: 25,
      period_start: '2023-01-01T00:00:00Z',
      period_end: '2023-01-31T23:59:59Z',
      type: 'revenue',
      unit: 'currency',
      metadata: { currency: 'USD', period_type: 'monthly' },
      site_id: 'site-123',
      segment_id: null,
      is_highlighted: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    };

    // Setup mock for URL
    const mockUrl = new URL('https://example.com/api/revenue?segmentId=all&siteId=site-123&startDate=2023-01-01&endDate=2023-01-31');
    global.URL = jest.fn(() => mockUrl) as any;

    // Mock Supabase client
    const mockClientReturn = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis()
    };

    // Mock the select result for KPI lookup
    mockClientReturn.select.mockImplementation(() => {
      return {
        ...mockClientReturn,
        then: (callback: any) => Promise.resolve(callback({ data: [mockKpi], error: null }))
      };
    });

    (createApiClient as jest.Mock).mockReturnValue(mockClientReturn);
    
    // Create request and call API
    const request = createRequestMock('https://example.com/api/revenue?segmentId=all&siteId=site-123&startDate=2023-01-01&endDate=2023-01-31');
    
    // Spy on NextResponse.json
    const jsonSpy = jest.spyOn(NextResponse, 'json');
    
    // Call API
    await GET(request);
    
    // Check that NextResponse.json was called with expected args
    expect(jsonSpy).toHaveBeenCalledWith({
      actual: 5000,
      projected: 6000,
      estimated: 7500,
      currency: 'USD',
      percentChange: 25,
      periodType: 'monthly'
    });
    
    expect(mockClientReturn.from).toHaveBeenCalledWith('kpis');
  });

  it('should handle missing site ID', async () => {
    // Setup mock for URL
    const mockUrl = new URL('https://example.com/api/revenue?segmentId=all');
    global.URL = jest.fn(() => mockUrl) as any;
    
    // Create request
    const request = createRequestMock('https://example.com/api/revenue?segmentId=all');
    
    // Spy on NextResponse.json
    const jsonSpy = jest.spyOn(NextResponse, 'json');
    
    // Call API
    await GET(request);
    
    // Check that NextResponse.json was called with expected args and status
    expect(jsonSpy).toHaveBeenCalledWith(
      {
        actual: 0,
        projected: 0,
        estimated: 0,
        currency: "USD",
        percentChange: 0,
        periodType: "monthly"
      },
      { status: 400 }
    );
  });

  it('should create new KPI data if not found', async () => {
    // Mock Supabase response for KPI fetch (empty)
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis()
    };

    // First call returns no existing KPI
    mockSupabase.select.mockResolvedValueOnce({
      data: [],
      error: null
    });

    // Mock sales data
    const mockCurrentSales = [
      { amount: 1000 },
      { amount: 2000 }
    ];
    
    const mockPreviousSales = [
      { amount: 1000 },
      { amount: 1500 }
    ];

    // Second call returns current period sales
    mockSupabase.select.mockResolvedValueOnce({
      data: mockCurrentSales,
      error: null
    });

    // Third call returns previous period sales
    mockSupabase.select.mockResolvedValueOnce({
      data: mockPreviousSales,
      error: null
    });

    // Mock successful KPI insert
    mockSupabase.insert.mockResolvedValueOnce({
      error: null
    });

    (createApiClient as jest.Mock).mockReturnValue(mockSupabase);

    // Create mock request
    const request = createRequestMock('https://example.com/api/revenue?segmentId=all&siteId=site-456&startDate=2023-01-01&endDate=2023-01-31');

    // Call the API
    const response = await GET(request);
    const data = await response.json();

    // Verify the response
    expect(response.status).toBe(200);
    expect(data).toEqual({
      actual: 3000, // Sum of mockCurrentSales
      projected: 3600, // 3000 * 1.2
      estimated: 4500, // 3000 * 1.5
      currency: 'USD',
      percentChange: 20, // 20% increase from 2500 to 3000
      periodType: 'monthly'
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('kpis');
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  it('should handle error when site id is missing', async () => {
    // Create mock request without site ID
    const request = createRequestMock('https://example.com/api/revenue?segmentId=all&startDate=2023-01-01&endDate=2023-01-31');

    // Call the API
    const response = await GET(request);
    const data = await response.json();

    // Verify the response
    expect(response.status).toBe(400);
    expect(data).toEqual({
      actual: 0,
      projected: 0,
      estimated: 0,
      currency: "USD",
      percentChange: 0,
      periodType: "monthly"
    });
  });

  it('should handle database errors', async () => {
    // Mock Supabase response with error
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis()
    };

    mockSupabase.select.mockResolvedValue({
      data: null,
      error: new Error('Database error')
    });

    (createApiClient as jest.Mock).mockReturnValue(mockSupabase);

    // Create mock request
    const request = createRequestMock('https://example.com/api/revenue?segmentId=all&siteId=site-123&startDate=2023-01-01&endDate=2023-01-31');

    // Call the API
    const response = await GET(request);
    const data = await response.json();

    // Verify the response
    expect(response.status).toBe(500);
    expect(data).toEqual({
      actual: 0,
      projected: 0,
      estimated: 0,
      currency: "USD",
      percentChange: 0,
      periodType: expect.any(String)
    });
  });
  
  it('should standardize period dates for consistent KPI creation', async () => {
    // Create a mock Supabase client that returns standardized dates for KPIs
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis()
    };
    
    // Mock the behavior to return empty KPI first time
    mockSupabase.select.mockResolvedValueOnce({
      data: [],
      error: null
    });
    
    // Mock current period sales data
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ amount: 1000 }],
      error: null
    });
    
    // Mock previous period sales data
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ amount: 500 }],
      error: null
    });
    
    // Mock successful KPI insert with standardized dates
    mockSupabase.insert.mockImplementation((kpiData) => {
      // Capture the inserted data for assertions
      return {
        data: kpiData,
        error: null,
        select: () => ({
          single: () => ({
            data: kpiData,
            error: null
          })
        })
      };
    });
    
    (createApiClient as jest.Mock).mockReturnValue(mockSupabase);
    
    // Create request with custom dates (Jan 15th is mid-month)
    const request = createRequestMock('https://example.com/api/revenue?segmentId=all&siteId=site-789&userId=user-123&startDate=2023-01-15&endDate=2023-01-20');
    
    // Call API
    await GET(request);
    
    // Check that KPI was created with standardized monthly dates (Jan 1 - Jan 31)
    expect(mockSupabase.insert).toHaveBeenCalled();
    
    // Extract the call arguments to check standardized dates
    const insertCallArgs = mockSupabase.insert.mock.calls[0][0];
    
    // The standardized dates should start at beginning of month and end at end of month
    expect(insertCallArgs.period_start).toContain('2023-01-01');
    expect(insertCallArgs.period_end).toContain('2023-01-31');
    expect(insertCallArgs.metadata.period_type).toBe('monthly');
  });
}); 