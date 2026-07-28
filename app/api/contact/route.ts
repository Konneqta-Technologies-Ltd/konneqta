import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(process.env.GOOGLE_SCRIPT_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, sheet: 'Contact' }),
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(data, {
        status: data.duplicate ? 409 : 400,
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: 'Unable to send your message.',
      },
      {
        status: 500,
      },
    );
  }
}
