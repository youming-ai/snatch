import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/download')({
  POST: async ({ request }) => {
    try {
      const { url } = await request.json()

      if (!url) {
        return Response.json({ error: 'URL is required' }, { status: 400 })
      }

      // Detect platform
      let platform: 'instagram' | 'twitter' | 'tiktok' | null
      if (url.includes('instagram.com')) {
        platform = 'instagram'
      } else if (url.includes('x.com') || url.includes('twitter.com')) {
        platform = 'twitter'
      } else if (url.includes('tiktok.com')) {
        platform = 'tiktok'
      } else {
        return Response.json({ error: 'Unsupported platform' }, { status: 400 })
      }

      // Extract IDs
      let id: string | null = null
      if (platform === 'instagram') {
        const match = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/)
        id = match ? match[1] : null
      } else if (platform === 'twitter') {
        const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
        id = match ? match[1] : null
      } else if (platform === 'tiktok') {
        const match = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/)
        id = match ? match[1] : null
      }

      if (!id) {
        return Response.json({ error: 'Invalid URL format' }, { status: 400 })
      }

      // For now, return mock data
      // In a real implementation, you would call the actual download service here
      const mockResults = [
        {
          id: Date.now().toString(),
          type: platform === 'instagram' ? 'video' : 'video',
          url: url,
          thumbnail: `https://via.placeholder.com/400x300?text=${platform}`,
          downloadUrl: url,
          title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Content`,
          size: '2.4 MB',
          platform: platform
        }
      ]

      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate processing time

      return Response.json({ success: true, results: mockResults })
    } catch (error) {
      console.error('Download API error:', error)
      return Response.json(
        { error: 'Failed to process download request' },
        { status: 500 }
      )
    }
  }
})
