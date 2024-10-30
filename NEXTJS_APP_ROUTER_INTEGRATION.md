# Contribution Summary

### Contributor: Meet Bhimani

#### Date: 30-10-2024

---

## Overview

I have integrated support for the Next.js app router (Next.js 14) into the project, improving compatibility and functionality.

## Issues Addressed

### 1. Compatibility Issue

- **Description:** The previous implementation relied on `NextApiRequest` and `NextApiResponse`, which are incompatible with the new app router.
- **Solution:** Updated the handler functions to utilize `NextRequest` and `NextResponse` in the route handlers, ensuring compatibility with the app router.

### 2. Error Related to the `fs` Module

- **Description:** There were intermittent issues with the `fs` module not being found, stemming from the way the `ContentProvider` was wrapped.
- **Solution:** Instead of directly exporting the `ContentProvider` from `page.tsx`, I modified the export structure as follows:

#### Updated `app/page.tsx`

```javascript
import ContentProviderApp from './components/editor'
import { getStaticProps } from 'destack/build/server'

export default async function Page() {
  const props = await getStaticProps().then((d) => d.props)

  return (
    <div style={{ height: '100%', color: 'black' }}>
      <ContentProviderApp data={props?.data} standaloneServer={false} />
    </div>
  )
}
```

#### Updated app/components/editor.ts

```javascript
'use client'

import { ContentProvider } from 'destack'
export default ContentProvider
```

## Changes required in server to support app router

1. file: `lib/server/api/handle.ts`

- Made exports for the following functions: `getPackagePath`, `fs`, and `path`.

- Update the `getPackagePath` function to include an RSC check for requests from the route handler.

```javascript
const getPackagePath = () => {
  const pathCurrent = path.dirname(require.resolve('destack/package.json'))
  if (pathCurrent?.startsWith('(api)') || pathCurrent.startsWith('(rsc)')) {
    return path.join(process.cwd() as string, '..', pathCurrent as string)
  } else {
    return pathCurrent as string
  }
}
```

2. file: `lib/server/index.ts`

- Added the following exports

```javascript
export { loadAllData } from './api/handle'
export { getPackagePath } from './api/handle'
export { fs } from './api/handle'
export { path } from './api/handle'
```

3. file: `package.json`

- added following in `workspaces`

```javascript
"./dev/nextjs-app-router",
```

- added following in `scripts`

```javascript
"start:next-app-router": "npm start -w dev/nextjs-app-router",
"dev:next-app-router": "concurrently -k \"npm run dev -w lib\" \"npm run wait:browser && npm run dev -w dev/nextjs-app-router\"",
"build:next-app-router": "npm run build -w lib && npm run build -w dev/nextjs-app-router",
```

## Steps to Integrate in Next.js App Router Project (for Development in this repo)

- Create a New Next.js Project named `nextjs-app-router`

1. add `destack` dependency in `package.json`:

```javascript
"dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "next": "14.2.7",
    "destack": "file:../../lib/"
}
```

2. Add the following code in `app/page.tsx`:

```javascript
import ContentProviderApp from './components/editor'
import { getStaticProps } from 'destack/build/server'

export default async function Page() {
  const props = await getStaticProps().then((d) => d.props)

  return (
    <div style={{ height: '100%', color: 'black' }}>
      <ContentProviderApp data={props?.data} standaloneServer={false} />
    </div>
  )
}
```

3. Create `app/components/editor.ts` and add the following code:

```javascript
'use client'

import { ContentProvider } from 'destack'
export default ContentProvider
```

4. Create `app/api/builder/handle/route.ts` and add following code:

```javascript
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
```

5. Create one directory and file `nextjs-app-router/data/default.html`

## Other Code Improvements:

#### have made several improvements in code as follows

- Added catch blocks inside `lib/client/vanilla/editor.tsx` where necessary.
- Improved conditions inside `useEffect` in `lib/client/vanilla/index.tsx`.

## Additional Benefits

- **Flexible Routing:** You can create/add a builder on any path other than `/`.
  - **Step 1:** Create a folder inside `app` and name it according to the desired path.
  - **Step 2:** Paste the same content you added in `app/page.tsx` into this new folder.

## Conclusion

These contributions significantly enhance the project by:

- Ensuring compatibility with the Next.js app router(v14).
- Improving error handling.
- Allowing greater flexibility in routing.

## Acknowledgements

- Special thanks to [@mihir-kanzariya](https://github.com/mihir-kanzariya) for raising the issue that led me to implement this solution.

## Contact Information

Feel free to reach out if you need any assistance:

- **Email:** [meet.bhimani@bacancy.com](mailto:meet.bhimani@bacancy.com)
- **GitHub:** [meet-bhimani](https://github.com/meet-bhimani)
