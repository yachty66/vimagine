import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Paperclip, Globe, ArrowUp, Video, Sparkles, Zap } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#000000]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#000000] backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-[#01A478] rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Vimagine</span>
              </Link>
              <nav className="hidden md:flex space-x-6">
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  Community
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  Enterprise
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  Learn
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  Showcase
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="ghost" className="text-gray-400 hover:text-white">
                Log in
              </Button>
              <Button className="bg-[#01A478] text-white hover:bg-[#01A478]/90">Get started</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative">
        <div className="absolute inset-0 bg-[#000000]"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Create something{" "}
              <span className="inline-flex items-center">
                <Video className="w-12 h-12 md:w-16 md:h-16 text-[#01A478] mx-2" />
              </span>
              Vimagine
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Create videos by imagining everything with AI
            </p>

            {/* Input Section */}
            <div className="max-w-2xl mx-auto">
              <div className="relative bg-[#000000] rounded-2xl shadow-xl border border-gray-700 p-6">
                <div className="flex items-center space-x-4">
                  <Input
                    placeholder="Ask Vimagine to create a video..."
                    className="flex-1 border-0 text-lg placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-white"
                  />
                  <Button size="icon" className="bg-[#01A478] hover:bg-[#01A478]/90 text-white rounded-full w-12 h-12">
                    <ArrowUp className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-200">
                      <Paperclip className="w-4 h-4 mr-2" />
                      Attach
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-200">
                      <Globe className="w-4 h-4 mr-2" />
                      Public
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
              <Card className="border-gray-700 hover:border-[#01A478]/50 transition-colors bg-[#000000]">
                <CardContent className="p-6 text-center">
                  <Sparkles className="w-8 h-8 text-[#01A478] mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">AI-Powered</h3>
                  <p className="text-gray-300 text-sm">Generate stunning videos with advanced AI technology</p>
                </CardContent>
              </Card>
              <Card className="border-gray-700 hover:border-[#01A478]/50 transition-colors bg-[#000000]">
                <CardContent className="p-6 text-center">
                  <Zap className="w-8 h-8 text-[#01A478] mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Lightning Fast</h3>
                  <p className="text-gray-300 text-sm">Create professional videos in minutes, not hours</p>
                </CardContent>
              </Card>
              <Card className="border-gray-700 hover:border-[#01A478]/50 transition-colors bg-[#000000]">
                <CardContent className="p-6 text-center">
                  <Video className="w-8 h-8 text-[#01A478] mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Any Style</h3>
                  <p className="text-gray-300 text-sm">From animations to live-action, create any video style</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Community Section */}
      <section className="bg-[#000000] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-8">From the Community</h2>

          <Tabs defaultValue="popular" className="mb-8">
            <TabsList className="bg-[#000000] border border-gray-600">
              <TabsTrigger value="popular" className="data-[state=active]:bg-[#01A478] data-[state=active]:text-white">
                Popular
              </TabsTrigger>
              <TabsTrigger value="discover" className="data-[state=active]:bg-[#01A478] data-[state=active]:text-white">
                Discover
              </TabsTrigger>
              <TabsTrigger
                value="tutorials"
                className="data-[state=active]:bg-[#01A478] data-[state=active]:text-white"
              >
                Tutorials
              </TabsTrigger>
              <TabsTrigger
                value="animations"
                className="data-[state=active]:bg-[#01A478] data-[state=active]:text-white"
              >
                Animations
              </TabsTrigger>
              <TabsTrigger
                value="commercials"
                className="data-[state=active]:bg-[#01A478] data-[state=active]:text-white"
              >
                Commercials
              </TabsTrigger>
              <TabsTrigger
                value="music-videos"
                className="data-[state=active]:bg-[#01A478] data-[state=active]:text-white"
              >
                Music Videos
              </TabsTrigger>
              <TabsTrigger value="shorts" className="data-[state=active]:bg-[#01A478] data-[state=active]:text-white">
                Shorts
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card
                key={i}
                className="group hover:shadow-lg transition-shadow cursor-pointer bg-[#000000] border-gray-700"
              >
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="w-12 h-12 text-gray-400 group-hover:text-[#01A478] transition-colors" />
                    </div>
                    <Badge className="absolute top-3 left-3 bg-[#01A478] text-white">AI Generated</Badge>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-2">Sample Video {i}</h3>
                    <p className="text-gray-300 text-sm">Created with Vimagine AI</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Cookie Notice */}
      <div className="fixed bottom-4 right-4 max-w-sm">
        <Card className="border-gray-700 shadow-lg bg-[#000000]">
          <CardContent className="p-4">
            <h3 className="font-semibold text-white mb-2">Choose your cookies</h3>
            <p className="text-sm text-gray-300 mb-3">
              We use cookies to enhance your experience and keep your data secure.
            </p>
            <div className="flex space-x-2">
              <Button size="sm" className="bg-[#01A478] text-white hover:bg-[#01A478]/90 flex-1">
                Accept all
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-gray-600 bg-transparent text-gray-300 hover:text-white hover:border-gray-500"
              >
                Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}