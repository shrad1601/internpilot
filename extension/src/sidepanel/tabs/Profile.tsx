import { useState, useEffect, useCallback } from 'react'
import { SERVER } from '../../shared/config'


async function getToken(): Promise<string | null> {
  return new Promise((r) =>
    chrome.storage.local.get('ipToken', (d) =>
      r((d as { ipToken?: string }).ipToken ?? null),
    ),
  )
}

interface PersonalProfile {
  firstName: string; lastName: string; preferredName: string
  email: string; schoolEmail: string; phone: string; countryCode: string
  city: string; country: string
}
interface LinksProfile { linkedin: string; github: string; portfolio: string }
interface EducationEntry {
  school: string; degree: string; major: string
  startDate: string; expectedGraduation: string
}
interface AvailabilityProfile {
  earliestStart: string; latestEnd: string
  minWeeks: number | null; partTimeOk: boolean | null
}
interface ProfileData {
  personal: PersonalProfile
  links: LinksProfile
  education: EducationEntry[]
  skills: string[]
  availability: AvailabilityProfile
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  )
}

function Section({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
      >
        {title}
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-3 space-y-3 bg-white">{children}</div>}
    </div>
  )
}

const emptyProfile: ProfileData = {
  personal: {
    firstName: '', lastName: '', preferredName: '', email: '', schoolEmail: '',
    phone: '', countryCode: '+65', city: '', country: '',
  },
  links: { linkedin: '', github: '', portfolio: '' },
  education: [],
  skills: [],
  availability: { earliestStart: '', latestEnd: '', minWeeks: null, partTimeOk: null },
}

export default function Profile() {
  const [data, setData] = useState<ProfileData>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not paired — go to Settings to pair.'); setLoading(false); return }
    try {
      const res = await fetch(`${SERVER}/profile`, { headers: { 'X-IP-Token': token } })
      if (!res.ok) { setError(`Server error ${res.status}`); return }
      setData(await res.json() as ProfileData)
    } catch { setError('Cannot reach server.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save() {
    setSaving(true); setSaved(false); setError(null)
    const token = await getToken()
    if (!token) { setError('Not paired.'); setSaving(false); return }
    try {
      const res = await fetch(`${SERVER}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-IP-Token': token },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const d = await res.json() as { detail?: string }; setError(d.detail ?? `Error ${res.status}`); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { setError('Cannot reach server.') }
    finally { setSaving(false) }
  }

  function setP<K extends keyof PersonalProfile>(key: K, val: string) {
    setData((d) => ({ ...d, personal: { ...d.personal, [key]: val } }))
  }
  function setL<K extends keyof LinksProfile>(key: K, val: string) {
    setData((d) => ({ ...d, links: { ...d.links, [key]: val } }))
  }
  function setA<K extends keyof AvailabilityProfile>(key: K, val: string | number | boolean | null) {
    setData((d) => ({ ...d, availability: { ...d.availability, [key]: val } }))
  }
  function setEdu(idx: number, key: keyof EducationEntry, val: string) {
    setData((d) => {
      const ed = d.education.map((e, i) => i === idx ? { ...e, [key]: val } : e)
      return { ...d, education: ed }
    })
  }
  function addEdu() {
    setData((d) => ({
      ...d,
      education: [...d.education, { school: '', degree: '', major: '', startDate: '', expectedGraduation: '' }],
    }))
  }
  function removeEdu(idx: number) {
    setData((d) => ({ ...d, education: d.education.filter((_, i) => i !== idx) }))
  }

  if (loading) return <div className="text-center py-10 text-gray-400 text-sm">Loading profile…</div>

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600">{error}</div>
      )}

      <Section title="Personal Info" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="First Name" value={data.personal.firstName} onChange={(v) => setP('firstName', v)} />
          <Field label="Last Name" value={data.personal.lastName} onChange={(v) => setP('lastName', v)} />
        </div>
        <Field label="Preferred Name" value={data.personal.preferredName} onChange={(v) => setP('preferredName', v)} placeholder="(optional)" />
        <Field label="Email" value={data.personal.email} onChange={(v) => setP('email', v)} type="email" />
        <Field label="School Email" value={data.personal.schoolEmail} onChange={(v) => setP('schoolEmail', v)} type="email" placeholder="(optional)" />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Code" value={data.personal.countryCode} onChange={(v) => setP('countryCode', v)} placeholder="+65" />
          <div className="col-span-2">
            <Field label="Phone" value={data.personal.phone} onChange={(v) => setP('phone', v)} type="tel" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City" value={data.personal.city} onChange={(v) => setP('city', v)} />
          <Field label="Country" value={data.personal.country} onChange={(v) => setP('country', v)} />
        </div>
      </Section>

      <Section title="Links">
        <Field label="LinkedIn URL" value={data.links.linkedin} onChange={(v) => setL('linkedin', v)} type="url" />
        <Field label="GitHub URL" value={data.links.github} onChange={(v) => setL('github', v)} type="url" />
        <Field label="Portfolio URL" value={data.links.portfolio} onChange={(v) => setL('portfolio', v)} type="url" placeholder="(optional)" />
      </Section>

      <Section title="Education">
        {data.education.map((ed, i) => (
          <div key={i} className="space-y-2 border border-gray-100 rounded p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Entry {i + 1}</span>
              <button onClick={() => removeEdu(i)} className="text-xs text-red-400 hover:underline">Remove</button>
            </div>
            <Field label="School" value={ed.school} onChange={(v) => setEdu(i, 'school', v)} />
            <Field label="Degree" value={ed.degree} onChange={(v) => setEdu(i, 'degree', v)} />
            <Field label="Major" value={ed.major} onChange={(v) => setEdu(i, 'major', v)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start" value={ed.startDate} onChange={(v) => setEdu(i, 'startDate', v)} placeholder="Aug 2022" />
              <Field label="Grad / End" value={ed.expectedGraduation} onChange={(v) => setEdu(i, 'expectedGraduation', v)} placeholder="Apr 2026" />
            </div>
          </div>
        ))}
        <button
          onClick={addEdu}
          className="w-full border border-dashed border-gray-300 rounded py-1.5 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500"
        >
          + Add Education
        </button>
      </Section>

      <Section title="Availability">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Earliest Start" value={data.availability.earliestStart} onChange={(v) => setA('earliestStart', v)} placeholder="May 2026" />
          <Field label="Latest End" value={data.availability.latestEnd} onChange={(v) => setA('latestEnd', v)} placeholder="Aug 2026" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Min internship length (weeks)</label>
          <input
            type="number"
            value={data.availability.minWeeks ?? ''}
            onChange={(e) => setA('minWeeks', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="e.g. 12"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="parttime"
            type="checkbox"
            checked={data.availability.partTimeOk === true}
            onChange={(e) => setA('partTimeOk', e.target.checked || null)}
            className="rounded"
          />
          <label htmlFor="parttime" className="text-xs text-gray-600">Open to part-time</label>
        </div>
      </Section>

      <Section title="Skills">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Skills (one per line)</label>
          <textarea
            value={data.skills.join('\n')}
            onChange={(e) => setData((d) => ({ ...d, skills: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }))}
            rows={6}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>
      </Section>

      <button
        onClick={save}
        disabled={saving}
        className={`w-full py-2 rounded font-medium text-sm transition-colors ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40'
        }`}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Profile'}
      </button>
    </div>
  )
}
