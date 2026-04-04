/**
 * Test improved date parsing with various formats
 * Run with: node test-improved-date-parsing.js
 */

// Improved date comparison function
function compareDates(date1, date2) {
  try {
    // Handle timezone issues by comparing only the date part, not time
    let d1;
    let d2;
    
    // Helper function to parse date safely
    const parseDate = (dateInput) => {
      if (typeof dateInput === 'string') {
        // If it's already a string in YYYY-MM-DD format, use it directly
        if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateInput;
        }
        
        // Handle different string formats
        let normalizedDate = dateInput;
        
        // Convert YYYY/MM/DD to YYYY-MM-DD
        if (dateInput.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
          normalizedDate = dateInput.replace(/\//g, '-');
        }
        // Convert DD/MM/YYYY to YYYY-MM-DD
        else if (dateInput.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const parts = dateInput.split('/');
          normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        // Convert MM/DD/YYYY to YYYY-MM-DD
        else if (dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          const parts = dateInput.split('/');
          const month = parts[0].padStart(2, '0');
          const day = parts[1].padStart(2, '0');
          normalizedDate = `${parts[2]}-${month}-${day}`;
        }
        
        // Parse the normalized date
        const parsed = new Date(normalizedDate + 'T00:00:00.000Z');
        if (isNaN(parsed.getTime())) {
          throw new Error(`Invalid date: ${dateInput}`);
        }
        return parsed.toISOString().split('T')[0];
      } else {
        // For Date objects, extract date components to avoid timezone issues
        const year = dateInput.getFullYear();
        const month = String(dateInput.getMonth() + 1).padStart(2, '0');
        const day = String(dateInput.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    };
    
    d1 = parseDate(date1);
    d2 = parseDate(date2);
    
    console.log(`[Date Comparison] Comparing "${d1}" vs "${d2}"`);
    return d1 === d2;
  } catch (error) {
    console.error('[Date Comparison] Error:', error);
    return false;
  }
}

function testDateParsing() {
  console.log('🧪 Testing Improved Date Parsing...\n');

  const expectedDate = '2002-11-20';
  
  const testCases = [
    { input: '2002-11-20', description: 'YYYY-MM-DD format' },
    { input: '2002/11/20', description: 'YYYY/MM/DD format' },
    { input: '20/11/2002', description: 'DD/MM/YYYY format' },
    { input: '11/20/2002', description: 'MM/DD/YYYY format' },
    { input: new Date('2002-11-20T00:00:00.000Z'), description: 'Date object (UTC)' },
    { input: new Date('2002-11-20'), description: 'Date object (local)' },
    { input: '2002-11-19', description: 'Wrong date (should fail)' },
    { input: '2002/11/19', description: 'Wrong date with slashes (should fail)' }
  ];

  console.log(`Expected date: ${expectedDate}\n`);

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  Input: ${testCase.input} (${typeof testCase.input})`);
    
    try {
      const result = compareDates(testCase.input, expectedDate);
      console.log(`  Result: ${result ? '✅ MATCH' : '❌ NO MATCH'}`);
    } catch (error) {
      console.log(`  Result: ❌ ERROR - ${error.message}`);
    }
    console.log('');
  });

  console.log('✨ Date parsing test completed!');
}

testDateParsing();