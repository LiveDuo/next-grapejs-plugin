import React, { useEffect, useRef, useState } from 'react'

import './index.css'

import PoweredBy from './powered'
import Editor from './editor'

interface ContentProviderBaseProps {
  data: any
  standaloneServer: boolean
}

interface dataType {
  content: string
  name?: string
}

const ContentProvider: React.FC<ContentProviderBaseProps> = ({ data, standaloneServer }) => {
  const [templateData, setTemplateData] = useState<string | undefined>()

  useEffect(() => {
    if (data && data?.length > 0) {
      const url = location.pathname === '/' ? '/' : `${location.pathname}.html`
      const _templateData = data?.find(({ name }: dataType) => name === url)
      setTemplateData(_templateData.content)
    }
  }, [])

  if (data && data?.length > 0)
    return (
      <>
        <div id="page" dangerouslySetInnerHTML={{ __html: templateData! }} />
        <PoweredBy />
      </>
    )
  else return <Editor standaloneServer={standaloneServer} />
}
export { ContentProvider }

const ContentProviderReact: React.FC<ContentProviderBaseProps> = () => {
  const mounted = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const [data, setData] = useState<dataType[]>()

  const loadData = async () => {
    const isDev = '_self' in React.createElement('div')
    if (isDev) {
      setData(undefined)
      setLoaded(true)
      return
    }

    const url = location.pathname === '/' ? '/default.html' : `${location.pathname}.html`
    const _data = await fetch(`/data/${url}`).then((r) => r.text())
    setData([{ content: _data, name: location.pathname }])
    setLoaded(true)
  }

  useEffect(() => {
    if (mounted.current) return

    loadData()

    mounted.current = true
  }, [])

  return loaded && <ContentProvider data={data} standaloneServer={true} />
}
export { ContentProviderReact }
