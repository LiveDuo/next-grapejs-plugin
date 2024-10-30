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
