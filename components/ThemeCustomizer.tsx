'use client'

import { ThemeCustomization } from '@/lib/themes'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface ThemeCustomizerProps {
  userId: string
  initial: ThemeCustomization
  isPro: boolean
  onUpdate: (custom: ThemeCustomization) => void  // for live preview
}

export default function ThemeCustomizer({
  userId,
  initial,
  isPro,
  onUpdate,
}: ThemeCustomizerProps) {
  const [custom, setCustom]   = useState<ThemeCustomization>(initial)
  const [saving, setSaving]   = useState(false)
  const [saved,  setSaved]    = useState(false)
  const supabase = createClient()

  // Update local state + fire live preview callback
  function update<K extends keyof ThemeCustomization>(
    key: K,
    value: ThemeCustomization[K]
  ) {
    const next = { ...custom, [key]: value }
    setCustom(next)
    onUpdate(next)   // parent rerenders preview immediately
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ theme_custom: custom })
      .eq('id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleReset() {
    setCustom({})
    onUpdate({})
    await supabase
      .from('profiles')
      .update({ theme_custom: {} })
      .eq('id', userId)
  }

  // Validate hex before updating
  function handleColorChange(key: keyof ThemeCustomization, value: string) {
    // Allow typing in progress (e.g. "#FF")
    if (value === '' || /^#[0-9A-Fa-f]{0,6}$/.test(value)) {
      update(key, value || undefined)
    }
  }

  if (!isPro) {
    return (
      <div style={{
        padding: '12px 16px',
        borderRadius: 10,
        background: 'var(--color-background-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
          🔒 Custom colors require Pro
        </p>
        <a href="" style={{ fontSize: 12, color: '#6366f1', fontWeight: 500 }}>
          Upgrade →
        </a>
      </div>
    )
  }

  const colorFields: { key: keyof ThemeCustomization; label: string }[] = [
    { key: 'accent',  label: 'Accent color'    },
    { key: 'bg',      label: 'Background'       },
    { key: 'text',    label: 'Name text'        },
    { key: 'subtext', label: 'Subtitle text'    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Colors ── */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>
          Colors
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {colorFields.map(({ key, label }) => (
            <div key={key}>
              <label style={{
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                display: 'block',
                marginBottom: 6,
              }}>
                {label}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Native color picker */}
                <input
                  type="color"
                  value={(custom[key] as string) || '#ffffff'}
                  onChange={e => update(key, e.target.value)}
                  style={{
                    width: 36, height: 36,
                    padding: 2,
                    border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: 'none',
                  }}
                />
                {/* Hex input */}
                <input
                  type="text"
                  value={(custom[key] as string) || ''}
                  onChange={e => handleColorChange(key, e.target.value)}
                  placeholder="#000000"
                  maxLength={7}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    padding: '7px 8px',
                    border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Avatar shape ── */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>
          Avatar shape
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['circle', 'rounded', 'square'] as const).map(shape => {
            const isActive = (custom.avatarShape ?? 'circle') === shape
            return (
              <button
                key={shape}
                onClick={() => update('avatarShape', shape)}
                style={{
                   flex: 1,
                  padding: '12px 0',
                  border: isActive
                    ? '2px solid #6366f1'
                    : '0.5px solid var(--color-border-secondary)',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Shape preview dot */}
                <div style={{
                  width: 28, height: 28,
                  background: custom.accent || '#6366f1',
                  borderRadius: shape === 'circle'
                  ? '50%'
                  : shape === 'rounded'
                    ? '8px'
                    : '2px',
                }} />
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {shape.charAt(0).toUpperCase() + shape.slice(1)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Font ── */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>
          Font
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {([
            { key: 'inter',    label: 'Inter',    sample: 'Modern' },
            { key: 'birthstone',  label: 'Birthstone',  sample: 'Classic' },
            { key: 'passero',     label: 'Passero One',     sample: 'Technical' },
            { key: 'playfair', label: 'Playfair', sample: 'Elegant' },
            { key: 'metamorphous', label: 'Metamorphous', sample: 'Elegant' },
          ] as const).map(({ key, label, sample }) => {
            const isActive = (custom.fontFamily ?? 'inter') === key
            return (
              <button
                key={key}
                onClick={() => update('fontFamily', key)}
                style={{
                  padding: '10px 12px',
                  border: isActive
                    ? '2px solid #6366f1'
                    : '0.5px solid var(--color-border-secondary)',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  display: 'block',
                  fontSize: 16,
                  color: 'var(--color-text-primary)',
                  fontFamily: key === 'inter' ? 'Inter, sans-serif'
                    : key === 'birthstone' ? 'Birthstone, serif'
                    : key === 'passero' ? 'Passero One'
                    : key === 'metamorphous' ? 'Metamorphous'
                    : "'Playfair Display', serif",
                }}>
                  Aa
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {label} · {sample}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: '11px 0',
            background: saving ? 'var(--color-background-secondary)' : '#6366f1',
            color: saving ? 'var(--color-text-secondary)' : '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : saved ? '✅ Saved' : 'Save changes'}
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '11px 16px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 8,
            background: 'transparent',
            fontSize: 13,
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}