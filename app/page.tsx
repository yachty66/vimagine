import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Play, ArrowUp, Video, Sparkles, Zap, Globe } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Pure Black & White Header */}
      <header className="border-b border-white/20 bg-black sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
                <Video className="w-4 h-4 text-black" />
              </div>
              <span className="text-lg font-semibold text-white">Vimagine</span>
            </Link>
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:text-black hover:bg-white"
              >
                Log in
              </Button>
              <Button
                size="sm"
                className="bg-white text-black hover:bg-white/90"
              >
                Get started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Minimal Hero Section */}
      <main className="max-w-4xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            Create videos with
            <span className="text-white"> AI</span>
          </h1>
          <p className="text-lg text-white/70 mb-12 max-w-2xl mx-auto">
            Create videos by imagining everything with AI
          </p>

          {/* Pure Black & White Input */}
          <div className="max-w-xl mx-auto mb-16">
            <div className="relative bg-black rounded-xl border border-white/30 p-4">
              <div className="flex items-center space-x-3">
                <Input
                  placeholder="Describe your video idea..."
                  className="flex-1 border-0 text-base placeholder:text-white/50 focus-visible:ring-0 bg-transparent text-white"
                />
                <Button
                  size="icon"
                  className="bg-white hover:bg-white/90 text-black rounded-lg w-10 h-10 shrink-0"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Pure Black & White Examples */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: "Product Demo",
                desc: "Create engaging product showcases",
              },
              {
                title: "Social Content",
                desc: "Generate viral social media videos",
              },
              {
                title: "Explainer Video",
                desc: "Turn complex ideas into simple videos",
              },
            ].map((example, i) => (
              <Card
                key={i}
                className="group hover:border-white transition-colors bg-black border-white/20 cursor-pointer"
              >
                <CardContent className="p-4">
                  <div className="aspect-video bg-white/10 rounded-lg mb-3 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white/60 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                  <h3 className="font-medium text-white text-sm mb-1">
                    {example.title}
                  </h3>
                  <p className="text-xs text-white/60">{example.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Pure Black & White Footer */}
      <footer className="border-t border-white/20 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                <Video className="w-3 h-3 text-black" />
              </div>
              <span className="text-sm font-medium text-white/70">
                Vimagine
              </span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-white/70">
              <Link href="#" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
