import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowLeft, Eye, EyeOff, MessageCircle, CheckCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredBranch, setPreferredBranch] = useState('Gandhidham');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [accountExistsInfo, setAccountExistsInfo] = useState(null);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAccountExistsInfo(null);

    try {
      if (isSignUp) {
        const cleanName = fullName.trim();
        const rawPhone = phone.trim();
        const rawEmail = email.trim().toLowerCase();
        const passwordVal = password.trim();

        if (!cleanName || cleanName.length < 2) {
          throw new Error('Please enter your full name.');
        }

        // Mobile number normalization (strictly 10 digits)
        const digitsOnly = rawPhone.replace(/\D/g, '');
        const cleanPhone = digitsOnly.length > 10 && (digitsOnly.startsWith('91') || digitsOnly.startsWith('0'))
          ? digitsOnly.slice(-10)
          : digitsOnly;

        if (!cleanPhone || cleanPhone.length !== 10) {
          throw new Error('Please enter a valid 10-digit mobile number (e.g. 9825012345).');
        }

        // Email is OPTIONAL: if provided, validate; if blank, auto-assign clean unique email
        let cleanEmail = rawEmail;
        if (cleanEmail) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            throw new Error('Please enter a valid email address (or leave email blank).');
          }
        } else {
          cleanEmail = `${cleanPhone}@customer.saj`;
        }

        if (!passwordVal || passwordVal.length < 3) {
          throw new Error('Please enter a password of at least 3 characters.');
        }

        let userRecord = null;

        // 1. Save directly into normal Supabase database table 'custom_users'
        if (isSupabaseConfigured()) {
          try {
            const { data: existingList, error: queryErr } = await supabase
              .from('custom_users')
              .select('*')
              .or(`email.eq.${cleanEmail},phone_number.eq.${cleanPhone},phone_number.eq.${rawPhone}`);

            if (queryErr) console.warn('Supabase check error:', queryErr);

            let existingUser = (existingList || []).find(u => {
              const uDigits = (u.phone_number || '').replace(/\D/g, '');
              return (
                uDigits.endsWith(cleanPhone) || 
                (u.email && u.email.toLowerCase() === cleanEmail) ||
                (u.email && u.email.toLowerCase() === `${cleanPhone}@customer.saj`)
              );
            });

            if (!existingUser) {
              const { data: allUsers } = await supabase.from('custom_users').select('*');
              existingUser = (allUsers || []).find(u => {
                const uDigits = (u.phone_number || '').replace(/\D/g, '');
                return uDigits.endsWith(cleanPhone) || (u.email && u.email.toLowerCase() === cleanEmail);
              });
            }

            if (existingUser) {
              // Smart Auto-Login if password matches!
              if (existingUser.password === passwordVal) {
                userRecord = existingUser;
              } else {
                setAccountExistsInfo({ phone: cleanPhone, email: existingUser.email });
                throw new Error(`An account with mobile number ${cleanPhone} is already registered.`);
              }
            }

            if (!userRecord) {
              const { data: newUser, error: insertError } = await supabase
                .from('custom_users')
                .insert([{
                  email: cleanEmail,
                  password: passwordVal,
                  full_name: cleanName,
                  phone_number: cleanPhone,
                  preferred_branch: preferredBranch
                }])
                .select()
                .single();

              if (insertError) {
                if (insertError.code === '23505' || (insertError.message && insertError.message.includes('unique'))) {
                  setAccountExistsInfo({ phone: cleanPhone });
                  throw new Error(`An account with mobile number ${cleanPhone} is already registered.`);
                }
                throw insertError;
              }
              userRecord = newUser;
            }
          } catch (dbErr) {
            console.warn('Supabase database signup handling:', dbErr.message);
            if (dbErr.message.includes('already registered') || dbErr.message.includes('already exists')) {
              throw dbErr;
            }
          }
        }

        // LocalStorage fallback if Supabase not configured or failed
        if (!userRecord) {
          const users = JSON.parse(localStorage.getItem('SAJ_users') || '[]');
          const found = users.find(u => {
            const uDigits = (u.phone_number || '').replace(/\D/g, '');
            return uDigits.endsWith(cleanPhone) || (u.email && u.email.toLowerCase() === cleanEmail);
          });

          if (found) {
            if (found.password === passwordVal) {
              userRecord = found;
            } else {
              setAccountExistsInfo({ phone: cleanPhone });
              throw new Error(`An account with mobile number ${cleanPhone} is already registered.`);
            }
          } else {
            userRecord = {
              id: 'user_' + Date.now(),
              email: cleanEmail,
              password: passwordVal,
              full_name: cleanName,
              phone_number: cleanPhone,
              preferred_branch: preferredBranch,
              created_at: new Date().toISOString()
            };
          }
        }

        // Save login info permanently
        const users = JSON.parse(localStorage.getItem('SAJ_users') || '[]');
        const existingIdx = users.findIndex(u => u.id === userRecord.id);
        if (existingIdx >= 0) users[existingIdx] = userRecord;
        else users.push(userRecord);

        localStorage.setItem('SAJ_users', JSON.stringify(users));
        localStorage.setItem('userId', userRecord.id);
        localStorage.setItem('SAJ_current_user', JSON.stringify(userRecord));
        localStorage.setItem('SAJ_wishlist_user', userRecord.email);

        alert(`Welcome ${userRecord.full_name || 'Member'}! Today's rates are now unlocked.`);
        navigate('/');
        return;
      } else {
        // LOGIN
        const rawIdent = identifier.trim();
        const cleanIdent = rawIdent.toLowerCase();
        const passwordVal = password.trim();

        if (!rawIdent || !passwordVal) {
          throw new Error('Please enter your mobile number or email, and password.');
        }

        const identDigits = rawIdent.replace(/\D/g, '');
        const cleanPhoneIdent = identDigits.length > 10 && (identDigits.startsWith('91') || identDigits.startsWith('0'))
          ? identDigits.slice(-10)
          : identDigits;

        let userRecord = null;

        // 1. Authenticate against normal Supabase database table 'custom_users'
        if (isSupabaseConfigured()) {
          try {
            let query = supabase.from('custom_users').select('*');
            if (cleanPhoneIdent && cleanPhoneIdent.length === 10) {
              query = query.or(`email.eq.${cleanIdent},phone_number.eq.${cleanIdent},phone_number.eq.${cleanPhoneIdent},email.eq.${cleanPhoneIdent}@customer.saj`);
            } else {
              query = query.or(`email.eq.${cleanIdent},phone_number.eq.${cleanIdent}`);
            }

            const { data: matchedUsers, error: loginError } = await query;
            if (loginError) console.warn('Supabase login query error:', loginError);

            if (matchedUsers && matchedUsers.length > 0) {
              const matched = matchedUsers.find(u => u.password === passwordVal);
              if (matched) userRecord = matched;
            }

            // Fallback: check all users by phone digits match
            if (!userRecord && cleanPhoneIdent && cleanPhoneIdent.length === 10) {
              const { data: allUsers } = await supabase.from('custom_users').select('*');
              const foundUser = (allUsers || []).find(u => {
                const uDigits = (u.phone_number || '').replace(/\D/g, '');
                return uDigits.endsWith(cleanPhoneIdent) && u.password === passwordVal;
              });
              if (foundUser) userRecord = foundUser;
            }
          } catch (dbErr) {
            console.warn('Supabase database login fallback:', dbErr.message);
          }
        }

        // LocalStorage fallback
        if (!userRecord) {
          const users = JSON.parse(localStorage.getItem('SAJ_users') || '[]');
          const found = users.find(u => {
            const uDigits = (u.phone_number || '').replace(/\D/g, '');
            const matchIdent = (
              u.email.toLowerCase() === cleanIdent || 
              u.phone_number === cleanIdent || 
              (cleanPhoneIdent && uDigits.endsWith(cleanPhoneIdent))
            );
            return matchIdent && u.password === passwordVal;
          });
          if (found) {
            userRecord = found;
          }
        }

        if (!userRecord) {
          throw new Error('Invalid mobile number/email or password. Please verify credentials or contact WhatsApp support.');
        }

        // Save login info permanently
        localStorage.setItem('userId', userRecord.id);
        localStorage.setItem('SAJ_current_user', JSON.stringify(userRecord));
        localStorage.setItem('SAJ_wishlist_user', userRecord.email);

        navigate('/');
        return;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #faf8f5 0%, #ffffff 100%)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font-sans)'
    }}>
      <div style={{ 
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '440px', 
        padding: '36px 30px', 
        background: '#ffffff', 
        border: '1px solid rgba(123, 17, 34, 0.15)',
        borderRadius: '16px', 
        boxShadow: '0 20px 50px rgba(123, 17, 34, 0.08)',
        boxSizing: 'border-box'
      }}>
        {/* Back Button */}
        <Link 
          to="/" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-gray)',
            textDecoration: 'none',
            fontWeight: '600',
            marginBottom: '18px'
          }}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          Back to Store
        </Link>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(123, 17, 34, 0.08)',
            color: 'var(--royal-gold)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <Lock style={{ width: '22px', height: '22px' }} />
          </div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '800',
            color: 'var(--text-dark)',
            margin: '0 0 6px',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            {isSignUp ? 'Create Free Member Account' : 'Member Login'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-gray)', margin: 0 }}>
            {isSignUp 
              ? "Sign up with your mobile number to unlock today's gold & silver rates." 
              : "Login with your mobile number or email to view today's certified rates."}
          </p>
        </div>

        {/* Toggle Mode */}
        <div style={{
          display: 'flex',
          background: '#f4f1ea',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(null); setAccountExistsInfo(null); }}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: '6px',
              background: !isSignUp ? '#ffffff' : 'transparent',
              color: !isSignUp ? 'var(--royal-gold)' : 'var(--text-gray)',
              fontWeight: !isSignUp ? '700' : '500',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: !isSignUp ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(null); setAccountExistsInfo(null); }}
            style={{
              flex: 1,
              padding: '9px',
              border: 'none',
              borderRadius: '6px',
              background: isSignUp ? '#ffffff' : 'transparent',
              color: isSignUp ? 'var(--royal-gold)' : 'var(--text-gray)',
              fontWeight: isSignUp ? '700' : '500',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: isSignUp ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            SIGN UP
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '16px',
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: 600 }}>{error}</div>
            {accountExistsInfo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setIdentifier(accountExistsInfo.phone || '');
                    setError(null);
                    setAccountExistsInfo(null);
                  }}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--royal-gold)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🔑 Switch to Login with this Number
                </button>
                <a
                  href={`https://wa.me/919638888170?text=${encodeURIComponent(`Hello Shree Aradhna Jewellers, I need help logging in with mobile number ${accountExistsInfo.phone} to view today's rates.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 12px',
                    background: '#25D366',
                    color: '#ffffff',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <MessageCircle style={{ width: '14px', height: '14px' }} />
                  Forgot Password? WhatsApp Support
                </a>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {isSignUp ? (
            <>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dark)', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dark)', marginBottom: '6px' }}>
                  Mobile Number * <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'normal' }}>(10 Digits)</span>
                </label>
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={14}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9825012345"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dark)' }}>
                    Email Address
                  </label>
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>Optional</span>
                </div>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Optional (or leave blank)"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dark)', marginBottom: '6px' }}>
                  Create Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 14px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dark)', marginBottom: '6px' }}>
                  Preferred Showroom Branch
                </label>
                <select
                  value={preferredBranch}
                  onChange={(e) => setPreferredBranch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  <option value="Gandhidham">Gandhidham Showroom (Main Branch)</option>
                  <option value="Adipur">Adipur Showroom (Branch 2)</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dark)', marginBottom: '6px' }}>
                  Mobile Number or Email *
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="10-digit mobile number or email"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dark)', marginBottom: '6px' }}>
                  Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 14px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginBottom: '18px' }}>
                <a
                  href="https://wa.me/919638888170?text=Hello%20Shree%20Aradhna%20Jewellers,%20I%20forgot%20my%20password%20to%20view%20today%27s%20rates."
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: 'var(--royal-gold)', textDecoration: 'none', fontWeight: '600' }}
                >
                  Forgot Password? WhatsApp Support
                </a>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: 'var(--royal-gold)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '700',
              fontSize: '13px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(218, 165, 32, 0.35)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account & Unlock Rates' : 'Login & View Rates')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-gray)' }}>
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(null); setAccountExistsInfo(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--royal-gold)', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                Login here
              </button>
            </span>
          ) : (
            <span>
              New customer?{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(null); setAccountExistsInfo(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--royal-gold)', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                Sign Up Free
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
