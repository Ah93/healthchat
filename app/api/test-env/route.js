// Test endpoint to check environment variables
export const runtime = 'edge';
export async function GET() {
  try {
    const envCheck = {
      hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
      hasDeepSeekBaseURL: !!process.env.DEEPSEEK_BASE_URL,
      hasPineconeKey: !!process.env.PINECONE_API_KEY,
      hasPineconeIndex: !!process.env.PINECONE_INDEX,
      deepSeekBaseURL: process.env.DEEPSEEK_BASE_URL,
      pineconeIndex: process.env.PINECONE_INDEX,
    };

    return Response.json({
      message: "Environment variables check",
      env: envCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
