import { useState } from 'react'
import { ballotRpc } from './supabase'

const tripHome = import.meta.env.BASE_URL
const isErrorNotice = notice => /could not|use a four|valid vote/i.test(notice)

export default function Admin() {
  const [adminPin, setAdminPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [ballots, setBallots] = useState([])
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')

  const load = async pin => {
    try {
      const rows = await ballotRpc('admin_list_ballots', { p_admin_pin: pin })
      setBallots(rows.map(row => ({ name: row.ballot_name, votes: row.ballot_votes, updated_at: row.ballot_updated_at })))
    }
    catch { throw new Error('That PIN could not open the admin view.') }
  }
  const unlock = async event => {
    event.preventDefault()
    if (!/^\d{4}$/.test(adminPin)) return setNotice('Enter the four-digit Jefferson / Amber PIN.')
    try { await load(adminPin); setUnlocked(true); setNotice('') } catch (error) { setNotice(error.message) }
  }
  const save = async name => {
    try {
      const votes = JSON.parse(draft)
      if (!votes || Array.isArray(votes) || typeof votes !== 'object') throw new Error('Votes must be a JSON object.')
      await ballotRpc('admin_save_ballot', { p_admin_pin: adminPin, p_name: name, p_votes: votes })
      setEditing(null); setNotice('Ballot updated.'); await load(adminPin)
    } catch (error) { setNotice(error.message || 'Enter valid vote JSON.') }
  }
  const clearVotes = async name => {
    if (!window.confirm(`Clear all votes for ${name}? Their PIN will remain active.`)) return
    try { await ballotRpc('admin_save_ballot', { p_admin_pin: adminPin, p_name: name, p_votes: {} }); setNotice('Votes cleared.'); await load(adminPin) }
    catch { setNotice('Could not clear those votes.') }
  }
  const lock = () => { setAdminPin(''); setUnlocked(false); setBallots([]); setNotice('') }

  if (!unlocked) return <main className="admin-page"><header className="admin-header"><a href={tripHome}>← Trip voting</a><strong>Admin</strong></header><section className="admin-login"><h1>Ballot admin</h1><form onSubmit={unlock}><label>Admin PIN<input type="password" inputMode="numeric" autoComplete="off" maxLength="4" value={adminPin} onChange={e => setAdminPin(e.target.value)} required /></label><button>Open ballots</button></form>{notice && <p className={`admin-notice ${isErrorNotice(notice) ? 'error' : ''}`}>{notice}<button className="dismiss-notice" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></p>}</section></main>

  return <main className="admin-page"><header className="admin-header"><a href={tripHome}>← Trip voting</a><strong>Ballot admin</strong><button onClick={lock}>Lock admin</button></header><section className="admin-content"><div className="admin-topline"><div><h1>Ballots</h1><p>Edit the stored JSON or clear a household’s votes while preserving its PIN.</p></div><button onClick={() => load(adminPin).catch(() => setNotice('Could not refresh ballots.'))}>Refresh</button></div>{notice && <p className={`admin-notice ${isErrorNotice(notice) ? 'error' : ''}`}>{notice}<button className="dismiss-notice" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></p>}<div className="ballot-list">{ballots.map(ballot => <article key={ballot.name} className="ballot-row"><div><strong>{ballot.name}</strong><small>Updated {new Date(ballot.updated_at).toLocaleString()}</small></div>{editing === ballot.name ? <div className="ballot-edit"><textarea value={draft} onChange={e => setDraft(e.target.value)} aria-label={`${ballot.name} vote JSON`} /><button onClick={() => save(ballot.name)}>Save</button><button className="quiet" onClick={() => setEditing(null)}>Cancel</button></div> : <><code>{JSON.stringify(ballot.votes)}</code><div className="ballot-actions"><button onClick={() => { setEditing(ballot.name); setDraft(JSON.stringify(ballot.votes, null, 2)) }}>Edit</button><button className="danger" onClick={() => clearVotes(ballot.name)}>Clear votes</button></div></>}</article>)}</div></section></main>
}
