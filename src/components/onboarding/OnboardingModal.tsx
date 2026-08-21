import { useState } from 'react'

const SLIDES = [
  {
    icon: '📋',
    title: 'Check In to a Store',
    body: 'Tap Check, find your store, and start a visit. The app records your check-in time and location automatically.',
  },
  {
    icon: '📸',
    title: 'Capture Photos',
    body: 'Photograph displays, stock, POS material, and competitor activity. Photos sync automatically when you are online.',
  },
  {
    icon: '💬',
    title: 'Leave Feedback',
    body: 'Rate the store vibe, capture what is affecting sales, and flag any issues or follow-ups for your manager.',
  },
  {
    icon: '📶',
    title: 'Works Offline',
    body: 'No signal? No problem. Everything you capture is saved locally and syncs to the server when connectivity returns.',
  },
]

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0)

  function next() {
    if (slide < SLIDES.length - 1) {
      setSlide(s => s + 1)
    } else {
      localStorage.setItem('ios_onboarding_done', '1')
      onDone()
    }
  }

  const s = SLIDES[slide]

  return (
    <div className="fixed inset-0 bg-ios-navy flex flex-col items-center justify-center px-8 z-50">
      <div className="text-center w-full max-w-sm">
        <div className="text-6xl mb-6">{s.icon}</div>
        <h2
          className="text-white text-xl font-bold mb-4"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {s.title}
        </h2>
        <p
          className="text-blue-200 text-sm leading-relaxed mb-10"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {s.body}
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i === slide ? 'bg-white' : 'bg-blue-700'}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full py-3 rounded-lg bg-ios-blue text-white font-bold text-sm"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {slide < SLIDES.length - 1 ? 'Next' : 'Get Started'}
        </button>

        {slide < SLIDES.length - 1 && (
          <button
            onClick={() => { localStorage.setItem('ios_onboarding_done', '1'); onDone() }}
            className="mt-3 text-blue-400 text-sm"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
