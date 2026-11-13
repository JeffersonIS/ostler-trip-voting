import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { ballotRpc } from './supabase'
import Admin from './Admin'

// Every trip uses the same standalone JSON schema. Add a new file here to add a trip.
const tripModules = import.meta.glob('./data/trips/*.json', { eager: true, import: 'default' })
const orderedTrips = Object.values(tripModules).sort((first, second) => first.sortOrder - second.sortOrder)

const voters = ['Scott / Delene', 'Amanda', 'Jackson / Katie', 'Harrison / Jerika', 'Jefferson / Amber', 'Benson', 'Wilson / Emily', 'Saydi / Dave']
const siteBase = import.meta.env.BASE_URL
const publicAsset = path => `${siteBase}${path.replace(/^\//, '')}`
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const totalFor24 = trip => trip.airfarePerPerson === null ? 'Airfare estimate needed' : money(trip.propertyCost + trip.airfarePerPerson * 24)
const isErrorNotice = notice => /not correct|not ready|could not|use a four|do not match|rate every|choose one|already submitted|unlock your ballot/i.test(notice)
const tabLabel = label => label.length > 20 ? `${label.slice(0, 19)}…` : label
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const localSessionKey = 'ostler-trip-2027-local-session'

function StarPicker({ value, onChange, disabled = false }) {
  return <div className="stars" aria-label="Your rating">
    {[1, 2, 3, 4, 5].map(star => <button key={star} disabled={disabled} className={star <= value ? 'on' : ''} onClick={() => onChange(star)} aria-label={`${star} star${star === 1 ? '' : 's'}`}>★</button>)}
  </div>
}

function CardStars({ value }) {
  return <span className="card-stars" aria-label={value ? `${value} out of 5 stars` : 'Not yet rated'}>{[1, 2, 3, 4, 5].map(star => <span key={star} className={star <= value ? 'on' : ''}>★</span>)}</span>
}

function TripComparison({ onClose, selectTrip, votes, rate, chooseFavorite, locked }) {
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="comparison-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="comparison-dialog" role="dialog" aria-modal="true" aria-labelledby="comparison-title">
      <header className="comparison-header"><div><h2 id="comparison-title">Compare trips</h2><p>All cost estimates are for 14 nights.</p></div><button className="comparison-close" onClick={onClose} aria-label="Close trip comparison">×</button></header>
      <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Trip</th>{orderedTrips.map(trip => <th key={trip.id}><img src={publicAsset(trip.image)} alt="" />{trip.location}</th>)}</tr><tr className="comparison-vote-row"><th>Your vote</th>{orderedTrips.map(trip => <th key={trip.id}><StarPicker value={votes[trip.id] || 0} onChange={rating => rate(trip.id, rating)} disabled={locked} /><button className={`comparison-favorite ${votes._favorite === trip.id ? 'selected' : ''}`} onClick={() => chooseFavorite(trip.id)} disabled={locked} aria-label={`Make ${trip.location} your favorite trip`} aria-pressed={votes._favorite === trip.id}>★ Favorite</button></th>)}</tr></thead><tbody><tr><th>Property cost</th>{orderedTrips.map(trip => <td key={trip.id}>{money(trip.propertyCost)}</td>)}</tr><tr><th>Airfare avg.</th>{orderedTrips.map(trip => <td key={trip.id}>{trip.airfarePerPerson === null ? 'TBD' : `${money(trip.airfarePerPerson)}/person`}</td>)}</tr><tr className="comparison-emphasis"><th>Est. total · 24 people</th>{orderedTrips.map(trip => <td key={trip.id}>{totalFor24(trip)}</td>)}</tr><tr><th>Travel time</th>{orderedTrips.map(trip => <td key={trip.id}>{trip.travelTime}</td>)}</tr><tr><th>November weather</th>{orderedTrips.map(trip => <td key={trip.id}>{trip.weather}</td>)}</tr><tr><th>Stay</th>{orderedTrips.map(trip => <td key={trip.id}>{trip.stay}</td>)}</tr><tr><th>Chef</th>{orderedTrips.map(trip => <td key={trip.id}>{trip.privateChef ? 'Included' : 'Not included'}</td>)}</tr><tr><th>Property</th>{orderedTrips.map(trip => <td key={trip.id}>{trip.facts.slice(0, 2).join(' · ')}</td>)}</tr></tbody><tfoot><tr><th>Details</th>{orderedTrips.map(trip => <td key={trip.id}><button onClick={() => { selectTrip(trip); onClose() }}>View trip</button></td>)}</tr></tfoot></table></div>
    </section>
  </div>
}

function Landing({ voter, chooseVoter, activeVoter, hasBallot, pin, setPin, confirmPin, setConfirmPin, unlock, notice, clearNotice }) {
  return <main className="landing-page"><section className="landing-card"><p className="landing-kicker">Time to Vote!</p><h1>OSTLER TRIP 2027</h1><p className="landing-copy">Choose your household. Create or enter your pin</p><select aria-label="Choose your name" value={voter} onChange={e => chooseVoter(e.target.value)}><option value="">Choose your name</option>{voters.map(name => <option key={name}>{name}</option>)}</select>{activeVoter && hasBallot !== null && <form onSubmit={unlock}><input autoFocus type="password" inputMode="numeric" autoComplete="off" placeholder="PIN" maxLength="4" pattern="[0-9]{4}" value={pin} onChange={e => setPin(e.target.value)} />{!hasBallot && <input type="password" inputMode="numeric" autoComplete="off" placeholder="Confirm PIN" maxLength="4" pattern="[0-9]{4}" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />}<button>{hasBallot ? 'Unlock ballot' : 'Create ballot'}</button></form>}{notice && <p className={`landing-notice ${isErrorNotice(notice) ? 'error' : ''}`}>{notice}<button className="dismiss-notice" onClick={clearNotice} aria-label="Dismiss message">×</button></p>}</section><footer>Powered by Chicks & Maaaalyn Farming Co.</footer></main>
}

function Results() {
  const [ballots, setBallots] = useState([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const home = siteBase
  useEffect(() => { ballotRpc('public_results').then(setBallots).catch(() => setNotice('Results are not available yet.')).finally(() => setLoading(false)) }, [])
  const summary = orderedTrips.map(trip => {
    const ratings = ballots.map(ballot => ballot.votes[trip.id]).filter(Boolean)
    const stars = ratings.reduce((total, rating) => total + rating, 0)
    return { trip, favorites: ballots.filter(ballot => ballot.votes._favorite === trip.id).length, stars, average: ratings.length ? stars / ratings.length : 0 }
  }).sort((a, b) => b.favorites - a.favorites || b.stars - a.stars)
  const favoriteWinners = summary.filter(item => item.favorites === Math.max(...summary.map(candidate => candidate.favorites)))
  const popularWinners = summary.filter(item => item.stars === Math.max(...summary.map(candidate => candidate.stars)))
  const winnerSet = (title, winners, metric) => <section className="winner-set"><p className="landing-kicker">{winners.length > 1 ? title.replace('WINNER', 'TIED WINNERS') : title}</p><div className="winner-cards">{winners.map(({ trip, favorites, stars }) => <article key={trip.id}><img src={publicAsset(trip.image)} alt={trip.title} /><div><h2>{trip.location}</h2><p>{metric === 'favorites' ? `${favorites} favorite vote${favorites === 1 ? '' : 's'}` : `${stars} total stars`}</p><a href={trip.listingUrl} target="_blank" rel="noreferrer">Open {trip.badge} ↗</a></div></article>)}</div></section>
  return <main className="results-page"><header className="results-header"><a href={home}>← Trip voting</a><strong>Submitted ballots</strong></header><section className="results-content"><p className="landing-kicker">OSTLER TRIP 2027</p><h1>Results</h1>{loading ? <p className="results-intro">Loading results…</p> : notice ? <p className="landing-notice error">{notice}<button className="dismiss-notice" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></p> : <>{ballots.length > 0 && <section className="results-winners">{winnerSet('WINNER BY FAVORITE VOTES', favoriteWinners, 'favorites')}{winnerSet('WINNER BY POPULAR VOTE · TOTAL STARS', popularWinners, 'stars')}</section>}<div className="results-table-wrap"><table className="results-table"><thead><tr><th>Household</th><th>Favorite</th>{orderedTrips.map(trip => <th key={trip.id}>{trip.location}</th>)}</tr></thead><tbody>{ballots.length ? ballots.map(ballot => <tr key={ballot.household}><th>{ballot.household}</th><td>{orderedTrips.find(trip => trip.id === ballot.votes._favorite)?.location || '—'}</td>{orderedTrips.map(trip => <td key={trip.id}>{ballot.votes[trip.id] ? `${ballot.votes[trip.id]} ★` : '—'}</td>)}</tr>) : <tr><td colSpan={orderedTrips.length + 2}>No ballots have been submitted yet.</td></tr>}</tbody>{ballots.length > 0 && <tfoot><tr><th>Total stars</th><td>—</td>{orderedTrips.map(trip => <td key={trip.id}>{ballots.reduce((total, ballot) => total + (ballot.votes[trip.id] || 0), 0)} ★</td>)}</tr></tfoot>}</table></div>{ballots.length > 0 && <div className="summary-list">{summary.map(({ trip, favorites, stars, average }) => <div key={trip.id}><strong>{trip.location}</strong><span>{favorites} favorite vote{favorites === 1 ? '' : 's'} · {stars} total stars · {average.toFixed(1)} ★ avg</span></div>)}</div>}</>}</section></main>
}

function App() {
  const [voter, setVoter] = useState('')
  const [customVoter, setCustomVoter] = useState('')
  const [votes, setVotes] = useState({})
  const [hasBallot, setHasBallot] = useState(null)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [activePin, setActivePin] = useState('')
  const [activeTrip, setActiveTrip] = useState(orderedTrips[0])
  const [notice, setNotice] = useState('')
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    if (!isLocalDevelopment) return
    let saved
    try { saved = JSON.parse(localStorage.getItem(localSessionKey)) } catch { return }
    if (!saved?.name || !saved?.pin) return
    ballotRpc('get_ballot', { p_name: saved.name, p_pin: saved.pin }).then(savedVotes => {
      setVoter(saved.name); setHasBallot(true); setActivePin(saved.pin); setVotes(savedVotes || {}); setIsUnlocked(true)
    }).catch(() => localStorage.removeItem(localSessionKey))
  }, [])

  const activeVoter = voter === 'Add my name…' ? customVoter.trim() : voter
  const chooseVoter = async name => {
    setVoter(name); setIsUnlocked(false); setActivePin(''); setVotes({}); setPin(''); setConfirmPin(''); setNotice(''); setHasBallot(null)
    if (!name) return
    try { setHasBallot(await ballotRpc('ballot_exists', { p_name: name })) }
    catch { setNotice('The voting service is not ready yet. Please try again shortly.') }
  }
  const unlock = async event => {
    event.preventDefault()
    if (!activeVoter) return setNotice('Enter your name first.')
    if (!/^\d{4}$/.test(pin)) return setNotice('Use a four-digit PIN.')
    try {
      let savedVotes
      if (hasBallot) {
        savedVotes = await ballotRpc('get_ballot', { p_name: activeVoter, p_pin: pin })
      } else {
        if (pin !== confirmPin) return setNotice('Those PINs do not match.')
        savedVotes = await ballotRpc('create_ballot', { p_name: activeVoter, p_pin: pin })
        setHasBallot(true)
      }
      setActivePin(pin); setIsUnlocked(true); setVotes(savedVotes || {}); setPin(''); setConfirmPin(''); setNotice('')
      if (isLocalDevelopment) localStorage.setItem(localSessionKey, JSON.stringify({ name: activeVoter, pin }))
    } catch { setNotice('That PIN is not correct. Please try again.') }
  }
  const rate = async (tripId, rating) => {
    if (!isUnlocked) { setNotice('Select your name and unlock your private ballot first.'); return }
    if (votes._submittedAt) { setNotice('Your ballot has already been submitted and locked.'); return }
    // `votes` only contains the unlocked voter's choices while the app is open.
    const voterVotes = { ...votes, [tripId]: rating }
    setVotes(voterVotes)
    try { await ballotRpc('save_ballot', { p_name: activeVoter, p_pin: activePin, p_votes: voterVotes }); setNotice('') }
    catch { setNotice('Could not save that vote. Please unlock your ballot again.') }
  }
  const chooseFavorite = async tripId => {
    if (!isUnlocked) { setNotice('Select your name and unlock your private ballot first.'); return }
    if (votes._submittedAt) { setNotice('Your ballot has already been submitted and locked.'); return }
    const voterVotes = { ...votes, _favorite: tripId }
    setVotes(voterVotes)
    try { await ballotRpc('save_ballot', { p_name: activeVoter, p_pin: activePin, p_votes: voterVotes }); setNotice('') }
    catch { setNotice('Could not save that favorite. Please unlock your ballot again.') }
  }
  const submitVotes = async () => {
    if (!isUnlocked) return setNotice('Unlock your ballot first.')
    if (votes._submittedAt) return
    const unrated = orderedTrips.filter(trip => !votes[trip.id])
    if (unrated.length) return setNotice('Rate every trip before submitting your ballot.')
    if (!votes._favorite) return setNotice('Choose one favorite trip before submitting.')
    if (!window.confirm('Submit and lock your ballot? You will not be able to edit it afterward.')) return
    const voterVotes = { ...votes, _submittedAt: new Date().toISOString() }
    setVotes(voterVotes)
    try { await ballotRpc('save_ballot', { p_name: activeVoter, p_pin: activePin, p_votes: voterVotes }); setNotice('Your ballot is officially submitted and locked.') }
    catch { setNotice('Could not submit your ballot. Please try again.') }
  }
  const switchVoter = () => { if (isLocalDevelopment) localStorage.removeItem(localSessionKey); setIsUnlocked(false); setActivePin(''); setVoter(''); setVotes({}); setPin(''); setConfirmPin(''); setNotice('') }

  if (!isUnlocked) return <Landing voter={voter} chooseVoter={chooseVoter} activeVoter={activeVoter} hasBallot={hasBallot} pin={pin} setPin={setPin} confirmPin={confirmPin} setConfirmPin={setConfirmPin} unlock={unlock} notice={notice} clearNotice={() => setNotice('')} />

  return <main>
    <header className="header"><nav><div className="brand">Ostler Trip 2027 Voting</div><div className="header-controls"><a className="results-trigger" href={`${siteBase}?p=/results`}>Results</a><button className="compare-trigger" onClick={() => setShowComparison(true)}>Compare trips</button><button className={`header-submit ${votes._submittedAt ? 'locked' : ''}`} onClick={submitVotes} disabled={Boolean(votes._submittedAt)}>{votes._submittedAt ? 'Ballot submitted' : 'Submit & finalize ballot'}</button></div></nav></header>
    {showComparison && <TripComparison onClose={() => setShowComparison(false)} selectTrip={setActiveTrip} votes={votes} rate={rate} chooseFavorite={chooseFavorite} locked={Boolean(votes._submittedAt)} />}
    {notice && <p className={`notice wrap ${isErrorNotice(notice) ? 'error' : ''}`}>{notice}<button className="dismiss-notice" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></p>}
    <div className="mobile-trip-menu wrap" aria-label="Choose a trip"><button onClick={() => setActiveTrip(orderedTrips[(orderedTrips.indexOf(activeTrip) - 1 + orderedTrips.length) % orderedTrips.length])} aria-label="Previous trip">‹</button><strong aria-live="polite">{activeTrip.location}</strong><button onClick={() => setActiveTrip(orderedTrips[(orderedTrips.indexOf(activeTrip) + 1) % orderedTrips.length])} aria-label="Next trip">›</button></div>
    <section className="trip-card-menu wrap" aria-label="Trip locations">{orderedTrips.map(trip => <button key={trip.id} onClick={() => setActiveTrip(trip)} className={activeTrip.id === trip.id ? 'active' : ''}><strong className="tab-card-name" title={trip.location}>{tabLabel(trip.location)}{votes._favorite === trip.id && <span className="card-favorite" title="My favorite trip">★</span>}</strong><span className="tab-card-bottom"><img src={publicAsset(trip.image)} alt="" /><small><CardStars value={votes[trip.id] || 0} /></small></span></button>)}</section>
    <section className="trip-dossier">
      <div className="map-background" aria-hidden="true" />
      <div className="vote-submission wrap"><div className="rating-submission"><span>Vote for this trip</span><div className="rating-choice"><StarPicker value={votes[activeTrip.id] || 0} onChange={rating => rate(activeTrip.id, rating)} disabled={Boolean(votes._submittedAt)} /><small>1 = Nope · 5 = Let’s Go</small></div></div><div className="favorite-choice"><button disabled={Boolean(votes._submittedAt)} className={votes._favorite === activeTrip.id ? 'selected' : ''} onClick={() => chooseFavorite(activeTrip.id)} aria-pressed={votes._favorite === activeTrip.id} aria-label={`Make ${activeTrip.title} your favorite trip`}>★</button><span>This is my favorite</span>{!votes._favorite && <small>Required on One trip</small>}</div></div>
      <div className="detail-layout wrap">
        <div className="trip-summary"><h1>{activeTrip.title}</h1><p className="property-location">{activeTrip.destination}</p><div className="link-row"><a className="map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeTrip.mapQuery || activeTrip.destination)}`} target="_blank" rel="noreferrer">Open in Maps ↗</a><a className="listing" href={activeTrip.listingUrl} target="_blank" rel="noreferrer">Open {activeTrip.badge} ↗</a></div><table className="glance-table"><tbody><tr><th>Cost (14 nights)</th><td>{activeTrip.price} + {money(activeTrip.airfarePerPerson)}/person airfare avg</td></tr><tr><th>Total cost estimate</th><td>{totalFor24(activeTrip)} · 24 people</td></tr><tr><th>Travel time</th><td>{activeTrip.travelTime}</td></tr><tr><th>Weather in Nov</th><td>{activeTrip.weather}</td></tr></tbody></table></div>
        <div className="trip-media"><img className="property-image" src={publicAsset(activeTrip.image)} alt={`${activeTrip.title} vacation property`} /></div>
      </div>
    </section>
    <section className="more-details wrap">
      <div className="more-details-heading"><h2>More details</h2></div>
      <div className="more-details-content"><div className="more-details-grid"><div><h3>Property details</h3>{activeTrip.privateChef && <p className="chef-note">Private chef included</p>}<ul>{activeTrip.facts.map(item => <li key={item}>{item}</li>)}</ul></div><div><h3>Activities</h3><ul>{activeTrip.activities.map(item => <li key={item}>{item}</li>)}</ul></div><div><h3>Snorkeling</h3><p className="snorkeling-detail">{activeTrip.snorkeling}</p></div></div></div>
      <iframe className="details-map" title={`${activeTrip.title} map`} src={`https://www.google.com/maps?q=${encodeURIComponent(activeTrip.mapQuery || activeTrip.destination)}&t=k&output=embed`} loading="lazy" />
    </section>
    <footer>Powered by Chicks & Maaaalyn Farming Co.</footer>
  </main>
}

const route = new URLSearchParams(window.location.search).get('p') || window.location.pathname
const isAdminRoute = route.endsWith('/admin')
const isResultsRoute = route.endsWith('/results')
createRoot(document.getElementById('root')).render(isAdminRoute ? <Admin /> : isResultsRoute ? <Results /> : <App />)
