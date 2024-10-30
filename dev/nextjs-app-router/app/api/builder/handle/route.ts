import { getPackagePath, fs, path, loadData, updateData, uploadFiles } from 'destack/build/server'
import { NextRequest, NextResponse } from 'next/server'

// Helper function to extract query parameters from the request URL
function getQueryParams(req: NextRequest) {
  const url = new URL(req.url)
  const queryParams = Object.fromEntries(url.searchParams.entries())
  return queryParams
}

// Handle GET request with appropriate content types for 'theme', 'asset', and default cases
export async function GET(req: NextRequest) {
  try {
    const queryParams = getQueryParams(req)
    const result = await handleEditorNew(req, { query: queryParams })

    // Handle 'theme' type requests, returning JSON
    if (queryParams.type == 'theme') {
      const responseBody = await result.clone().json()
      return NextResponse.json(responseBody)
    }

    // Handle 'asset' type requests, returning binary data (for preview images)
    if (queryParams.type === 'asset') {
      const arrayBuffer = await result.arrayBuffer()
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    }

    // Default response, returning JSON
    const response = await result.json()
    return new NextResponse(response, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error handling GET request:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Handle POST requests with JSON or file uploads based on content type
export async function POST(req: NextRequest) {
  try {
    const queryParams = getQueryParams(req)

    const result = await handleEditorNew(req, { query: queryParams })

    // Handle 'theme' type requests, returning JSON
    if (queryParams.type == 'theme') {
      const responseBody = await result.clone().json()
      return NextResponse.json(responseBody)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error handling POST request:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Handle data-related operations: Load or update data based on request method
async function handleDataNew(req: NextRequest) {
  try {
    const queryParams = getQueryParams(req)

    if (req.method === 'GET') {
      // Load data based on path and extension, defaulting to 'html'
      const data = await loadData(queryParams.path, queryParams.ext || 'html')
      return NextResponse.json(data)
    } else if (req.method === 'POST') {
      const contentType = req.headers.get('content-type')
      const isMultiPart = contentType?.startsWith('multipart/form-data')

      // Handle regular JSON data updates
      if (!isMultiPart) {
        const body = req.body
        await updateData(queryParams.path, queryParams.ext || 'html', body)
        return NextResponse.json({})
      }

      // Handle file uploads for multipart/form-data
      const urls = await uploadFiles(req)
      return NextResponse.json(urls)
    }

    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  } catch (error) {
    console.error('Error handling data in handleDataNew:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Handle asset requests (i.e. image files)
async function handleAssetNew(req: NextRequest) {
  try {
    if (req.method === 'GET') {
      const queryParams = getQueryParams(req)
      const assetPath = path.join(getPackagePath(), queryParams.path)
      const data = await fs.promises.readFile(assetPath)

      return new NextResponse(data, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': data.length.toString(),
        },
      })
    }
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
  } catch (error) {
    console.error('Error handling asset in handleAssetNew:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Handle theme requests, loading components for a specific theme
async function handleThemeNew(req: NextRequest) {
  try {
    if (req.method === 'GET') {
      const queryParams = getQueryParams(req)
      const themeName = queryParams.name
      const folderPath = path.join(getPackagePath(), 'themes', themeName)

      // Load components from the theme folder (excluding index.ts and hidden files)
      const componentNames = await fs.promises
        .readdir(folderPath)
        .then((f: any[]) => f.filter((c) => c !== 'index.ts' && !c.startsWith('.')))

      // Read each component's source code
      const componentsP = componentNames.map(async (c: any) => {
        const assetPath = path.join(folderPath, c, 'index.html')
        const source = await fs.promises.readFile(assetPath, 'utf-8')
        return { source, folder: c }
      })
      const components = await Promise.all(componentsP)
      return NextResponse.json(components)
    }
    return NextResponse.json({ error: 'Not allowed' }, { status: 405 })
  } catch (error) {
    console.error('Error handling theme in handleThemeNew:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Main handler that delegates requests to specific handlers based on type
async function handleEditorNew(req: NextRequest, { query }: { query: any }) {
  try {
    // Delegate based on query type: 'data', 'asset', or 'theme'
    if (query.type === 'data') {
      return handleDataNew(req)
    } else if (query.type === 'asset') {
      return handleAssetNew(req)
    } else if (query.type === 'theme') {
      return handleThemeNew(req)
    }
    return NextResponse.json({ error: 'Invalid Type' }, { status: 400 })
  } catch (error) {
    console.error('Error handling editor request:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
