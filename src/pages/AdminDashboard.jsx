import { useState, useEffect } from 'react';
import { 
  supabase, 
  isSupabaseConfigured, 
  getSupabaseConfig, 
  setSupabaseConfig, 
  clearSupabaseConfig, 
  testSupabaseConnection,
  runVigorousStorageTests,
  SUPABASE_SCHEMA_SQL
} from '../lib/supabase';
import { 
  fetchLiveRates, 
  saveLiveRates, 
  sendRatePushNotification,
  fetchCustomProducts, 
  saveCustomProduct, 
  updateCustomProduct, 
  deleteCustomProduct,
  DEFAULT_RATES 
} from '../lib/cloudSync';
import { optimizeImageForStorage } from '../lib/imageOptimizer';

const ADMIN_CATEGORIES = ['LADIES', 'GENTS', 'RINGS', 'EARRINGS', 'WEDDING SET'];
const ADMIN_SUBCATEGORIES = {
  'ALL': ['ALL'],
  'RINGS': ['ALL', 'LADIES RINGS', 'GENTS RINGS'],
  'EARRINGS': ['ALL', 'DAILY WEAR TOPS', 'STUDS', 'HOOPS', 'FANCY'],
  'LADIES': ['ALL', 'RINGS', 'BANGLES', 'BRACELETS', 'SHORT MANGALSUTRA', 'NECKLACES', 'CHAINS'],
  'GENTS': ['ALL', 'RINGS', 'CHAINS'],
  'WEDDING SET': ['ALL']
};

export default function AdminDashboard() {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Supabase Cloud Configuration State
  const initialConfig = getSupabaseConfig();
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(initialConfig.url);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(initialConfig.key);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Vigorous Storage Testing State
  const [runningStorageTest, setRunningStorageTest] = useState(false);
  const [storageTestResults, setStorageTestResults] = useState(null);

  // Live Rates State
  const [gold24k, setGold24k] = useState('15085');
  const [gold22k, setGold22k] = useState('13818');
  const [gold18k, setGold18k] = useState('11465');
  const [silver, setSilver] = useState('214');
  const [hide24k, setHide24k] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [pushingRates, setPushingRates] = useState(false);

  // Products Catalog Management State
  const [products, setProducts] = useState([]);
  const [prodTitle, setProdTitle] = useState('');
  const [prodCategory, setProdCategory] = useState('LADIES');
  const [prodSubCategory, setProdSubCategory] = useState('ALL');
  const [prodEarringType, setProdEarringType] = useState('ALL');
  const [prodPurity, setProdPurity] = useState('22K');
  const [prodWeight, setProdWeight] = useState('');
  const [prodImageFile, setProdImageFile] = useState(null);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [filterAdminCategory, setFilterAdminCategory] = useState('ALL');

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('LADIES');
  const [editSubCategory, setEditSubCategory] = useState('ALL');
  const [editEarringType, setEditEarringType] = useState('ALL');
  const [editPurity, setEditPurity] = useState('22K');
  const [editWeight, setEditWeight] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Store Settings State
  const [storeUpi, setStoreUpi] = useState('9638888170@okbizaxis');
  const [updatingUpi, setUpdatingUpi] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [instaUrl, setInstaUrl] = useState('');

  // Alerts & Inquiries State
  const [sendingAlert, setSendingAlert] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [searchInquiry, setSearchInquiry] = useState('');

  // Registered Customers State
  const [customUsers, setCustomUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [filterUserBranch, setFilterUserBranch] = useState('ALL');
  const [editingUserId, setEditingUserId] = useState(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [savingUserPassword, setSavingUserPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    const envPasscode = import.meta.env.VITE_ADMIN_PASSCODE || 'umang@12';
    if (passcode === envPasscode || passcode === 'Papersoft@5577' || passcode === 'umang@12' || passcode === 'arka@12') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid passcode');
    }
  };

  const fetchData = async () => {
    setLoading(true);

    let fetchedSettings = null;
    let fetchedInquiries = null;

    if (isSupabaseConfigured()) {
      try {
        const [settRes, inqRes] = await Promise.all([
          supabase.from('store_settings').select('*').eq('id', 1).maybeSingle(),
          supabase.from('inquiries').select('*').order('created_at', { ascending: false })
        ]);

        if (settRes.data) fetchedSettings = settRes.data;
        if (inqRes.data) fetchedInquiries = inqRes.data;
      } catch (err) {
        console.warn("Supabase AdminDashboard fetch fallback:", err.message);
      }
    }

    // 1. Settings Fallback
    const localSettings = JSON.parse(localStorage.getItem('SAJ_store_settings') || '{}');
    const activeSettings = fetchedSettings || localSettings;
    if (activeSettings.upi_id) setStoreUpi(activeSettings.upi_id);
    if (activeSettings.qr_code_url) setInstaUrl(activeSettings.qr_code_url);

    // 2. Multi-tier Live Rates Loader
    try {
      const activeRates = await fetchLiveRates();
      if (activeRates) {
        if (activeRates.gold24k) setGold24k(String(activeRates.gold24k));
        if (activeRates.gold22k) setGold22k(String(activeRates.gold22k));
        if (activeRates.gold18k) setGold18k(String(activeRates.gold18k));
        if (activeRates.silver) setSilver(String(activeRates.silver));
        if (activeRates.hide24k !== undefined) setHide24k(Boolean(activeRates.hide24k));
      }
    } catch (e) {
      console.warn("Rates fetch fallback in Admin:", e);
    }

    // 3. Multi-tier Products Loader
    try {
      const activeProducts = await fetchCustomProducts();
      if (activeProducts) {
        setProducts(activeProducts);
      }
    } catch (e) {
      console.warn("Products fetch fallback in Admin:", e);
    }

    // 4. Inquiries Fallback
    if (fetchedInquiries && fetchedInquiries.length > 0) {
      setInquiries(fetchedInquiries);
    } else {
      try {
        const storedInqs = JSON.parse(localStorage.getItem('SAJ_inquiries') || '[]');
        setInquiries(Array.isArray(storedInqs) ? storedInqs : []);
      } catch (e) {
        console.error('Error parsing inquiries:', e);
        setInquiries([]);
      }
    }

    // 5. Fetch Registered Customers
    fetchCustomUsers();

    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Test Supabase Connection
  const handleTestConnection = async () => {
    setTestingSupabase(true);
    setSupabaseTestStatus(null);
    try {
      const result = await testSupabaseConnection(supabaseUrlInput, supabaseKeyInput);
      setSupabaseTestStatus(result);
    } catch (err) {
      setSupabaseTestStatus({
        success: false,
        connected: false,
        message: err.message || 'Connection test failed'
      });
    } finally {
      setTestingSupabase(false);
    }
  };

  // Save Supabase Configuration
  const handleSaveSupabaseConfig = async (e) => {
    e.preventDefault();
    setTestingSupabase(true);
    
    // Save to local storage
    setSupabaseConfig(supabaseUrlInput, supabaseKeyInput);

    // Test connection with new config
    const testRes = await testSupabaseConnection(supabaseUrlInput, supabaseKeyInput);
    setSupabaseTestStatus(testRes);
    setTestingSupabase(false);

    if (testRes.success) {
      alert('Supabase connected successfully!');
      fetchData();
    } else {
      alert(`Supabase saved, but connection check returned: ${testRes.message}`);
    }
  };

  // Disconnect Supabase (Revert to Local Storage)
  const handleDisconnectSupabase = () => {
    if (!window.confirm('Disconnect from Supabase? The website will seamlessly continue operating in Local Storage mode.')) {
      return;
    }
    clearSupabaseConfig();
    setSupabaseUrlInput('');
    setSupabaseKeyInput('');
    setSupabaseTestStatus(null);
    alert('Disconnected from Supabase Cloud. Operating in Local Mode.');
  };

  // Copy SQL Schema to Clipboard
  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 3000);
      alert('SQL Schema copied to clipboard! Paste it into Supabase SQL Editor and click "Run".');
    } catch (e) {
      alert('Failed to copy. Please copy from the setup guide below.');
    }
  };

  // Save Live Rates with Global Multi-tier Sync
  const handleSaveRates = async (e) => {
    e.preventDefault();
    setSavingRates(true);

    try {
      const result = await saveLiveRates({
        gold24k: Number(gold24k),
        gold22k: Number(gold22k),
        gold18k: Number(gold18k),
        silver: Number(silver),
        hide24k: hide24k
      });

      if (result.globalSyncActive) {
        alert(`✅ Live Rates updated & globally synced!\n\n• 24K Gold: ₹${gold24k}/g\n• 22K Gold: ₹${gold22k}/g\n• 18K Gold: ₹${gold18k}/g\n• Silver: ₹${silver}/g\n\n🌐 Synced across GitHub Global Network & Supabase Cloud.\nCustomers visiting on mobile phones or any browser will immediately see these live rates.`);
      } else {
        alert(`✅ Rates updated successfully!\n\n• 24K Gold: ₹${gold24k}/g\n• 22K Gold: ₹${gold22k}/g\n• 18K Gold: ₹${gold18k}/g\n• Silver: ₹${silver}/g\n\n📌 Saved locally in browser storage & synced to all open tabs.`);
      }
    } catch (err) {
      console.error(err);
      alert('Error saving rates: ' + err.message);
    } finally {
      setSavingRates(false);
    }
  };

  // Manual Push Notification Dispatcher
  const handleManualPushNotification = async () => {
    setPushingRates(true);
    try {
      const res = await sendRatePushNotification({
        gold24k: Number(gold24k),
        gold22k: Number(gold22k),
        gold18k: Number(gold18k),
        silver: Number(silver),
        hide24k: hide24k
      });
      if (res && res.sent !== undefined) {
        alert(`👑 Live Rate Push Notification Dispatched!\n\nDelivered to ${res.sent} device(s) worldwide (out of ${res.total} registered devices).\n\nDelivered even when customer phones or browsers are completely closed!`);
      } else {
        alert('Notification triggered: ' + (res?.message || 'Dispatched successfully'));
      }
    } catch (err) {
      alert('Error dispatching push notification: ' + err.message);
    } finally {
      setPushingRates(false);
    }
  };

  // Product Image Handler (Supports HEIC / iPhone Photos)
  const handleProductFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileNameLower = (file.name || '').toLowerCase();
    const isHeic = fileNameLower.endsWith('.heic') || fileNameLower.endsWith('.heif');
    if (isHeic) {
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        });
        const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const convertedFile = new File([resultBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        setProdImageFile(convertedFile);
      } catch (err) {
        alert("Could not convert HEIC photo, please select a JPG or PNG image.");
      }
    } else {
      setProdImageFile(file);
    }
  };

  // Edit Product Image Handler
  const handleEditProductFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileNameLower = (file.name || '').toLowerCase();
    const isHeic = fileNameLower.endsWith('.heic') || fileNameLower.endsWith('.heif');
    if (isHeic) {
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        });
        const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const convertedFile = new File([resultBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        setEditImageFile(convertedFile);
      } catch (err) {
        alert("Could not convert HEIC photo, please select a JPG or PNG image.");
      }
    } else {
      setEditImageFile(file);
    }
  };

  // Upload Product Handler
  const handleUploadProduct = async (e) => {
    e.preventDefault();
    if (!prodImageFile) return alert("Please select a product image");
    setUploadingProduct(true);

    try {
      const optimizedFile = await optimizeImageForStorage(prodImageFile, 800, 800, 0.72);
      const fileExt = (optimizedFile.name || 'jpg').split('.').pop();
      const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      let finalImageUrl = null;

      if (isSupabaseConfigured()) {
        try {
          const { error: uploadErr } = await supabase.storage
            .from('product_images')
            .upload(fileName, optimizedFile, { cacheControl: '3600', upsert: true });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('product_images').getPublicUrl(fileName);
            finalImageUrl = urlData?.publicUrl;
          }
        } catch (storageEx) {
          console.warn("Supabase storage upload fallback:", storageEx.message);
        }
      }

      if (!finalImageUrl) {
        finalImageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(optimizedFile);
        });
      }

      const newProduct = {
        title: prodTitle.trim(),
        category: prodCategory,
        subCategory: prodSubCategory,
        earringType: prodEarringType,
        purity: prodPurity || '22K',
        weight: prodWeight || '',
        url: finalImageUrl
      };

      const result = await saveCustomProduct(newProduct);
      setProducts(prev => [result.product, ...prev.filter(p => String(p.id) !== String(result.product.id))]);

      if (result.globalSyncActive) {
        alert('✅ Product uploaded & globally synced!\n\nLive now under ' + prodCategory + ' / ' + prodSubCategory + ' across all customer devices.');
      } else {
        alert('✅ Product uploaded successfully!\n\nLive now under ' + prodCategory + ' / ' + prodSubCategory + ' (saved locally & synced across open tabs).');
      }

      setProdTitle('');
      setProdWeight('');
      setProdImageFile(null);
    } catch (err) {
      console.error(err);
      alert('Error uploading product: ' + err.message);
    } finally {
      setUploadingProduct(false);
    }
  };

  // Start Editing a Product
  const handleStartEdit = (p) => {
    setEditingProduct(p);
    setEditTitle(p.title || '');
    setEditCategory(p.category || 'LADIES');
    setEditSubCategory(p.subCategory || 'ALL');
    setEditEarringType(p.earringType || 'ALL');
    setEditPurity(p.purity || '22K');
    setEditWeight(p.weight || '');
    setEditPrice(p.price || '');
    setEditImageUrl(p.url || '');
    setEditImageFile(null);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditImageFile(null);
  };

  // Save Product Edits
  const handleSaveEditProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingEdit(true);

    try {
      let finalUrl = editImageUrl;

      if (editImageFile) {
        const optimizedFile = await optimizeImageForStorage(editImageFile, 800, 800, 0.72);
        const fileExt = (optimizedFile.name || 'jpg').split('.').pop();
        const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        if (isSupabaseConfigured()) {
          try {
            const { error: uploadErr } = await supabase.storage
              .from('product_images')
              .upload(fileName, optimizedFile, { cacheControl: '3600', upsert: true });

            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('product_images').getPublicUrl(fileName);
              if (urlData?.publicUrl) finalUrl = urlData.publicUrl;
            }
          } catch (storageEx) {
            console.warn("Supabase storage upload fallback:", storageEx.message);
          }
        }

        if (finalUrl === editImageUrl) {
          finalUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(optimizedFile);
          });
        }
      }

      const updatedFields = {
        title: editTitle.trim(),
        category: editCategory,
        subCategory: editSubCategory,
        earringType: editEarringType,
        purity: editPurity || '22K',
        weight: editWeight || '',
        price: editPrice ? Number(editPrice) : null,
        url: finalUrl
      };

      const result = await updateCustomProduct(editingProduct.id, updatedFields);
      setProducts(prev => prev.map(p => String(p.id) === String(editingProduct.id) ? { ...p, ...result.product } : p));
      setEditingProduct(null);

      alert('✅ Product updated & globally synced across all devices!');
    } catch (err) {
      console.error(err);
      alert('Error updating product: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Product Handler
  const handleDeleteProduct = async (prodId) => {
    if (!window.confirm("Are you sure you want to delete this product from the catalog?")) return;

    try {
      await deleteCustomProduct(prodId);
      setProducts(prev => prev.filter(p => String(p.id) !== String(prodId)));
      alert("✅ Product deleted and synced successfully!");
    } catch (err) {
      console.error(err);
      alert('Error deleting product: ' + err.message);
    }
  };

  // Update UPI
  const handleUpiUpdate = async (e) => {
    e.preventDefault();
    setUpdatingUpi(true);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('store_settings').upsert({ id: 1, upi_id: storeUpi });
      } catch (err) {
        console.warn("Supabase UPI update error:", err.message);
      }
    }

    const settings = JSON.parse(localStorage.getItem('SAJ_store_settings') || '{}');
    settings.upi_id = storeUpi;
    localStorage.setItem('SAJ_store_settings', JSON.stringify(settings));
    alert("UPI ID updated successfully!");
    setUpdatingUpi(false);
  };

  // Run Full Vigorous Storage Diagnostics
  const handleRunStorageDiagnostics = async () => {
    setRunningStorageTest(true);
    try {
      const results = await runVigorousStorageTests();
      setStorageTestResults(results);
    } catch (err) {
      alert('Storage diagnostic test failed: ' + err.message);
    } finally {
      setRunningStorageTest(false);
    }
  };

  // Upload QR Code
  const handleQrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setQrUploading(true);
    try {
      // Optimize image first to keep storage compact & fast
      const optimizedFile = await optimizeImageForStorage(file, 800, 800, 0.85);
      let finalQrUrl = null;

      if (isSupabaseConfigured()) {
        try {
          const fileExt = (optimizedFile.name || 'jpg').split('.').pop();
          const fileName = `store_qr_${Date.now()}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage
            .from('payment_screenshots')
            .upload(fileName, optimizedFile, { cacheControl: '3600', upsert: true });

          if (!uploadErr) {
            const { data } = supabase.storage.from('payment_screenshots').getPublicUrl(fileName);
            finalQrUrl = data.publicUrl;
            await supabase.from('store_settings').upsert({ id: 1, qr_code_url: finalQrUrl });
          }
        } catch (ex) {
          console.warn("Storage upload error for QR, using base64:", ex.message);
        }
      }

      if (!finalQrUrl) {
        finalQrUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(optimizedFile);
        });
      }

      const settings = JSON.parse(localStorage.getItem('SAJ_store_settings') || '{}');
      settings.qr_code_url = finalQrUrl;
      localStorage.setItem('SAJ_store_settings', JSON.stringify(settings));
      setInstaUrl(finalQrUrl);
      alert('Showroom QR Code updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Error uploading QR code');
    } finally {
      setQrUploading(false);
    }
  };

  // Fetch Registered Customers
  const fetchCustomUsers = async () => {
    if (!isSupabaseConfigured()) {
      const localUsers = JSON.parse(localStorage.getItem('SAJ_users') || '[]');
      setCustomUsers(localUsers);
      return;
    }
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('custom_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomUsers(data || []);
    } catch (err) {
      console.warn('Error fetching custom_users:', err.message);
      const localUsers = JSON.parse(localStorage.getItem('SAJ_users') || '[]');
      setCustomUsers(localUsers);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Reset Customer Password
  const handleResetUserPassword = async (userId, userName) => {
    if (!newPasswordVal.trim()) {
      alert('Please enter a new password');
      return;
    }
    setSavingUserPassword(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('custom_users')
          .update({ password: newPasswordVal.trim() })
          .eq('id', userId);
        if (error) throw error;
      }
      setCustomUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPasswordVal.trim() } : u));
      const localUsers = JSON.parse(localStorage.getItem('SAJ_users') || '[]');
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx >= 0) {
        localUsers[idx].password = newPasswordVal.trim();
        localStorage.setItem('SAJ_users', JSON.stringify(localUsers));
      }
      alert('Password for ' + userName + ' has been updated to "' + newPasswordVal.trim() + '".');
      setEditingUserId(null);
      setNewPasswordVal('');
    } catch (err) {
      alert('Error updating password: ' + err.message);
    } finally {
      setSavingUserPassword(false);
    }
  };

  // Delete Customer Account
  const handleDeleteCustomer = async (userId, userName) => {
    if (!window.confirm('Are you sure you want to delete customer account for "' + userName + '"?')) return;
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('custom_users').delete().eq('id', userId);
        if (error) throw error;
      }
      setCustomUsers(prev => prev.filter(u => u.id !== userId));
      const localUsers = JSON.parse(localStorage.getItem('SAJ_users') || '[]');
      localStorage.setItem('SAJ_users', JSON.stringify(localUsers.filter(u => u.id !== userId)));
      alert('Customer account for "' + userName + '" deleted.');
    } catch (err) {
      alert('Error deleting customer: ' + err.message);
    }
  };

  // Delete Inquiry
  const handleDeleteInquiry = async (inqId) => {
    if (!window.confirm("Are you sure you want to delete this inquiry?")) return;

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('inquiries').delete().eq('id', inqId);
      } catch (err) {
        console.warn("Supabase inquiry deletion error:", err.message);
      }
    }

    const updated = inquiries.filter(i => i.id !== inqId);
    localStorage.setItem('SAJ_inquiries', JSON.stringify(updated));
    setInquiries(updated);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '40px', background: '#1a1a1a', border: '1px solid var(--royal-gold)', borderRadius: '2px', textAlign: 'center' }}>
          <img src="/assets/logo.png" alt="SHREE ARADHNA JEWELLERS Logo" style={{ height: '64px', borderRadius: '12px', marginBottom: '20px' }} />
          <h2 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.8rem', marginBottom: '25px', letterSpacing: '2px' }}>
            ADMIN ACCESS
          </h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input 
              type="password" 
              placeholder="Enter Admin Passcode" 
              value={passcode} 
              onChange={(e) => setPasscode(e.target.value)}
              required
              style={{ padding: '12px 15px', background: '#000', border: '1px solid #333', color: '#fff', outline: 'none', textAlign: 'center', fontSize: '1.1rem', letterSpacing: '3px' }}
            />
            <button 
              type="submit" 
              style={{ padding: '12px', background: 'var(--royal-gold)', color: '#fff', border: 'none', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Enter Dashboard
            </button>
            <a href="/" style={{ color: '#888', textDecoration: 'none', fontSize: '0.85rem' }}>← Back to Website</a>
          </form>
        </div>
      </div>
    );
  }

  const filteredCustomers = customUsers.filter(u => {
    const term = searchCustomer.toLowerCase().trim();
    const matchesSearch = !term || 
      (u.full_name && u.full_name.toLowerCase().includes(term)) ||
      (u.phone_number && u.phone_number.includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term));
    const matchesBranch = filterUserBranch === 'ALL' || u.preferred_branch === filterUserBranch;
    return matchesSearch && matchesBranch;
  });

  const filteredInquiries = inquiries.filter(inq => {
    if (!searchInquiry) return true;
    const term = searchInquiry.toLowerCase();
    return (
      (inq.name && inq.name.toLowerCase().includes(term)) ||
      (inq.phone && String(inq.phone).includes(term)) ||
      (inq.branch && inq.branch.toLowerCase().includes(term)) ||
      (inq.category && inq.category.toLowerCase().includes(term)) ||
      (inq.notes && inq.notes.toLowerCase().includes(term))
    );
  });

  const isCloudConnected = isSupabaseConfigured();

  return (
    <div className="admin-container" style={{ minHeight: '100vh', background: '#0e0e0e', color: '#fff', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', flexWrap: 'wrap', gap: '20px', borderBottom: '1px solid #222', paddingBottom: '25px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img src="/assets/logo.png" alt="SAJ Logo" style={{ width: '48px', height: '48px', borderRadius: '8px' }} />
              <div>
                <h1 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '2rem', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
                  Shree Aradhna Jewellers
                </h1>
                <p style={{ color: '#888', margin: '4px 0 0', letterSpacing: '0.5px', fontSize: '0.88rem' }}>
                  Showroom Management Dashboard • Gandhidham & Adipur
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '6px 12px', 
              borderRadius: '20px', 
              fontSize: '0.78rem', 
              fontWeight: '600',
              background: isCloudConnected ? 'rgba(40, 167, 69, 0.15)' : 'rgba(255, 193, 7, 0.15)',
              color: isCloudConnected ? '#28a745' : '#ffc107',
              border: `1px solid ${isCloudConnected ? '#28a745' : '#ffc107'}`
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isCloudConnected ? '#28a745' : '#ffc107' }} />
              {isCloudConnected ? 'Supabase Cloud Connected' : 'Local Storage Mode'}
            </span>
            <a href="/" style={{ padding: '8px 16px', background: 'transparent', color: 'var(--royal-gold)', border: '1px solid var(--royal-gold)', textDecoration: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
              ← View Website
            </a>
            <button 
              onClick={() => setIsAuthenticated(false)}
              style={{ padding: '8px 16px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* 1. SUPABASE CLOUD DATABASE SETTINGS */}
        <div style={{ background: '#161616', padding: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>⚡</span> Supabase Cloud Database Configuration
              </h2>
              <p style={{ color: '#aaa', margin: 0, fontSize: '0.85rem' }}>
                Connect your website to Supabase PostgreSQL database for real-time rates sync, online inquiries, and storage.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleCopySchema}
                style={{
                  background: copiedSchema ? '#28a745' : '#222',
                  color: '#fff',
                  border: '1px solid #444',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                {copiedSchema ? '✓ SQL Copied!' : '📋 Copy SQL Schema'}
              </button>

              <button
                type="button"
                onClick={() => setShowSqlGuide(!showSqlGuide)}
                style={{
                  background: '#222',
                  color: 'var(--royal-gold)',
                  border: '1px solid var(--royal-gold)',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                {showSqlGuide ? 'Hide Setup Steps' : '📖 4-Step Setup Guide'}
              </button>
            </div>
          </div>

          {/* Quick Setup Instructions Accordion */}
          {showSqlGuide && (
            <div style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: '6px', padding: '20px', marginBottom: '22px' }}>
              <h4 style={{ color: 'var(--royal-gold)', margin: '0 0 12px', fontSize: '0.95rem' }}>Easy 4-Step Supabase Setup:</h4>
              <ol style={{ color: '#bbb', fontSize: '0.85rem', lineHeight: '1.7', margin: 0, paddingLeft: '20px' }}>
                <li>Log in to <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--royal-gold)' }}>supabase.com</a> and click <strong>"New project"</strong> (select region: India - Mumbai for best speed).</li>
                <li>Go to <strong>Project Settings → API</strong>. Copy your <strong>Project URL</strong> and <strong>anon public API key</strong>.</li>
                <li>Go to <strong>SQL Editor → New Query</strong>, click the <strong>"Copy SQL Schema"</strong> button above, paste the code, and click <strong>Run</strong>.</li>
                <li>Paste your Project URL & Anon Key into the inputs below and click <strong>"Test & Save Connection"</strong>!</li>
              </ol>
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSaveSupabaseConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px', fontWeight: '500' }}>
                  Supabase Project URL
                </label>
                <input 
                  type="url" 
                  placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co" 
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ color: '#aaa', fontSize: '0.82rem', fontWeight: '500' }}>
                    Supabase Anon Public API Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                  >
                    {showKey ? 'Hide Key' : 'Show Key'}
                  </button>
                </div>
                <input 
                  type={showKey ? 'text' : 'password'} 
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Test Status Banner */}
            {supabaseTestStatus && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                border: supabaseTestStatus.success ? '1px solid #28a745' : '1px solid #dc3545',
                background: supabaseTestStatus.success ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                color: supabaseTestStatus.success ? '#28a745' : '#ff6b6b',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span>{supabaseTestStatus.success ? '✓' : '✗'}</span>
                <span style={{ flex: 1 }}>{supabaseTestStatus.message}</span>
                {supabaseTestStatus.latencyMs && (
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>{supabaseTestStatus.latencyMs}ms</span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
              <button 
                type="submit" 
                disabled={testingSupabase}
                style={{
                  padding: '12px 22px',
                  background: 'var(--royal-gold)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  cursor: testingSupabase ? 'not-allowed' : 'pointer'
                }}
              >
                {testingSupabase ? 'Connecting...' : 'Save & Connect Supabase'}
              </button>

              <button 
                type="button" 
                onClick={handleTestConnection}
                disabled={testingSupabase}
                style={{
                  padding: '12px 20px',
                  background: '#222',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: testingSupabase ? 'not-allowed' : 'pointer'
                }}
              >
                {testingSupabase ? 'Testing...' : 'Test Connection'}
              </button>

              {isCloudConnected && (
                <button 
                  type="button" 
                  onClick={handleDisconnectSupabase}
                  style={{
                    padding: '12px 20px',
                    background: 'transparent',
                    color: '#dc3545',
                    border: '1px solid #dc3545',
                    borderRadius: '4px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginLeft: 'auto'
                  }}
                >
                  Disconnect (Use Local Mode)
                </button>
              )}
            </div>
          </form>
        </div>

        {/* VIGOROUS STORAGE & BUCKET DIAGNOSTICS */}
        <div style={{ background: '#161616', padding: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🛡️</span> Vigorous Storage & Bucket Diagnostics
              </h2>
              <p style={{ color: '#aaa', margin: 0, fontSize: '0.85rem' }}>
                Vigorously tests LocalStorage read/write fidelity, quota headroom, Supabase Storage buckets, and public CDN access.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunStorageDiagnostics}
              disabled={runningStorageTest}
              style={{
                padding: '10px 20px',
                background: runningStorageTest ? '#333' : 'var(--royal-gold)',
                color: runningStorageTest ? '#888' : '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: runningStorageTest ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {runningStorageTest ? 'Running Diagnostic Tests...' : '⚡ Run Vigorous Storage Tests'}
            </button>
          </div>

          {storageTestResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '0.88rem',
                fontWeight: '600',
                background: storageTestResults.overallSuccess ? 'rgba(40, 167, 69, 0.15)' : 'rgba(255, 193, 7, 0.15)',
                color: storageTestResults.overallSuccess ? '#28a745' : '#ffc107',
                border: `1px solid ${storageTestResults.overallSuccess ? '#28a745' : '#ffc107'}`
              }}>
                {storageTestResults.overallSuccess
                  ? '✓ All Storage & Persistence Subsystems are 100% Operational!'
                  : '⚠️ Storage Diagnostics Complete - Review Status Below:'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                {storageTestResults.tests.map((t) => (
                  <div 
                    key={t.id}
                    style={{
                      background: '#0d0d0d',
                      border: `1px solid ${t.passed ? '#2a442e' : '#522a2a'}`,
                      borderRadius: '6px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{t.name}</strong>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: t.passed ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)',
                          color: t.passed ? '#28a745' : '#dc3545'
                        }}>
                          {t.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <p style={{ color: '#aaa', fontSize: '0.8rem', margin: '4px 0 0', lineHeight: '1.4' }}>
                        {t.details}
                      </p>
                    </div>
                    {t.latencyMs && (
                      <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#666' }}>
                        Response latency: {t.latencyMs}ms
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. LIVE GOLD & SILVER RATES MANAGEMENT */}
        <div style={{ background: '#161616', padding: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', marginBottom: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>💰</span> Live Gold & Silver Rates (Gandhidham & Adipur)
            </h2>
            <p style={{ color: '#aaa', margin: 0, fontSize: '0.85rem' }}>
              Rates update live in real-time on the homepage banner and in the customer pricing calculations.
            </p>
          </div>

          <form onSubmit={handleSaveRates}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  24K Gold Rate (₹ / 10 gm)
                </label>
                <input 
                  type="number" 
                  value={gold24k} 
                  onChange={(e) => setGold24k(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  22K Gold Rate (₹ / 10 gm)
                </label>
                <input 
                  type="number" 
                  value={gold22k} 
                  onChange={(e) => setGold22k(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  18K Gold Rate (₹ / 10 gm)
                </label>
                <input 
                  type="number" 
                  value={gold18k} 
                  onChange={(e) => setGold18k(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  Silver Rate (₹ / 10 gm)
                </label>
                <input 
                  type="number" 
                  value={silver} 
                  onChange={(e) => setSilver(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <input 
                type="checkbox" 
                id="adminHide24kCheck"
                checked={hide24k}
                onChange={(e) => setHide24k(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--royal-gold)' }}
              />
              <label htmlFor="adminHide24kCheck" style={{ color: '#ffffff', fontSize: '0.88rem', cursor: 'pointer', userSelect: 'none' }}>
                Hide 24K Gold Rate from public display (Ticker & Live Rates Card)
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button 
                type="submit" 
                disabled={savingRates}
                style={{
                  padding: '12px 24px',
                  background: 'var(--royal-gold)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  cursor: savingRates ? 'not-allowed' : 'pointer'
                }}
              >
                {savingRates ? 'Updating Rates...' : 'Update Live Rates & Auto-Push'}
              </button>

              <button
                type="button"
                onClick={handleManualPushNotification}
                disabled={pushingRates}
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #7b1122 0%, #9c152b 100%)',
                  color: '#ffd700',
                  border: '1.5px solid #ffd700',
                  borderRadius: '4px',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: pushingRates ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {pushingRates ? 'Pushing to Devices...' : '🔔 Push Rate Notification to All Devices (Closed App Support)'}
              </button>
            </div>
          </form>
        </div>

        {/* 3. PRODUCT CATALOG & MASTER UPLOAD HUB */}
        <div style={{ background: '#161616', padding: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', marginBottom: '30px' }}>
          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>💎</span> Product Catalog & Master Upload Hub
            </h2>
            <p style={{ color: '#aaa', margin: 0, fontSize: '0.85rem' }}>
              Upload new jewellery pieces directly to your online showroom with automatic image optimization and instant live sync.
            </p>
          </div>

          {/* Upload Form */}
          <form onSubmit={handleUploadProduct} style={{ background: '#0e0e0e', padding: '24px', borderRadius: '8px', border: '1px solid #252525', marginBottom: '30px' }}>
            <h3 style={{ color: '#ffffff', fontSize: '1.05rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>➕</span> Add New Product
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  Product Title *
                </label>
                <input 
                  type="text" 
                  value={prodTitle} 
                  onChange={(e) => setProdTitle(e.target.value)}
                  placeholder="e.g. 22K Royal Peacock Bangle"
                  required
                  style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  Main Category *
                </label>
                <select
                  value={prodCategory}
                  onChange={(e) => {
                    setProdCategory(e.target.value);
                    setProdSubCategory('ALL');
                    setProdEarringType('ALL');
                  }}
                  style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                >
                  {ADMIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  Subcategory *
                </label>
                <select
                  value={prodSubCategory}
                  onChange={(e) => setProdSubCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                >
                  {(ADMIN_SUBCATEGORIES[prodCategory] || ['ALL']).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {prodCategory === 'EARRINGS' && (
                <div>
                  <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                    Earring Type
                  </label>
                  <select
                    value={prodEarringType}
                    onChange={(e) => setProdEarringType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                  >
                    {['ALL', 'DAILY WEAR TOPS', 'STUDS', 'HOOPS', 'FANCY'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  Purity
                </label>
                <select
                  value={prodPurity}
                  onChange={(e) => setProdPurity(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="24K">24K Gold (99.9%)</option>
                  <option value="22K">22K Gold (91.6% BIS)</option>
                  <option value="18K">18K Gold (75.0% BIS)</option>
                  <option value="92.5 Silver">92.5 Sterling Silver</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                  Weight (Optional)
                </label>
                <input 
                  type="text" 
                  value={prodWeight} 
                  onChange={(e) => setProdWeight(e.target.value)}
                  placeholder="e.g. 12.5g"
                  style={{ width: '100%', padding: '10px 12px', background: '#161616', border: '1px solid #333', color: '#fff', borderRadius: '4px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: '6px' }}>
                Product Image *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <input 
                  type="file" 
                  accept="image/*,.heic,.heif"
                  onChange={handleProductFileChange}
                  required
                  style={{ color: '#aaa', fontSize: '0.85rem' }}
                />
                {prodImageFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img 
                      src={URL.createObjectURL(prodImageFile)} 
                      alt="Preview" 
                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--royal-gold)' }} 
                    />
                    <span style={{ fontSize: '0.78rem', color: '#28a745' }}>✓ {prodImageFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={uploadingProduct}
              style={{
                padding: '12px 24px',
                background: 'var(--royal-gold)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: '700',
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                cursor: uploadingProduct ? 'not-allowed' : 'pointer'
              }}
            >
              {uploadingProduct ? 'Optimizing & Uploading...' : 'Upload Product to Catalog'}
            </button>
          </form>

          {/* Manage Existing Uploaded Products */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ color: '#ffffff', fontSize: '1.05rem', margin: 0 }}>
                Existing Uploaded Products ({products.length})
              </h3>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['ALL', ...ADMIN_CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterAdminCategory(cat)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: filterAdminCategory === cat ? 'var(--royal-gold)' : '#222',
                      color: filterAdminCategory === cat ? '#fff' : '#aaa',
                      border: '1px solid #333',
                      cursor: 'pointer'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', background: '#0e0e0e', borderRadius: '6px', color: '#666', border: '1px dashed #282828' }}>
                No custom products uploaded yet. Upload your first piece using the form above!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
                {products
                  .filter(p => filterAdminCategory === 'ALL' || p.category === filterAdminCategory)
                  .map(p => (
                    <div 
                      key={p.id}
                      style={{
                        background: '#0e0e0e',
                        border: '1px solid #282828',
                        borderRadius: '6px',
                        padding: '12px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        <img 
                          src={p.url} 
                          alt={p.title} 
                          style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #333', flexShrink: 0 }} 
                        />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.title}
                          </div>
                          <div style={{ color: 'var(--royal-gold)', fontSize: '0.75rem', marginTop: '2px' }}>
                            {p.category} {p.subCategory && p.subCategory !== 'ALL' ? `• ${p.subCategory}` : ''}
                          </div>
                          {p.purity && (
                            <div style={{ color: '#777', fontSize: '0.72rem', marginTop: '2px' }}>
                              {p.purity}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(p)}
                          style={{
                            background: 'rgba(212, 175, 55, 0.15)',
                            color: 'var(--royal-gold)',
                            border: '1px solid var(--royal-gold)',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          style={{
                            background: 'rgba(220, 53, 69, 0.15)',
                            color: '#ff4d4d',
                            border: '1px solid #ff4d4d',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* EDIT PRODUCT MODAL */}
        {editingProduct && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(5px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#161616',
              border: '1px solid var(--royal-gold)',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #2a2a2a', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>✏️</span> Edit Product Details
                </h3>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: '1.4rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditProduct}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '6px' }}>Product Title</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '6px' }}>Main Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => {
                        setEditCategory(e.target.value);
                        setEditSubCategory('ALL');
                      }}
                      style={{ width: '100%', padding: '10px', background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: '6px' }}
                    >
                      {ADMIN_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '6px' }}>Sub-Category</label>
                    <select
                      value={editSubCategory}
                      onChange={(e) => setEditSubCategory(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: '6px' }}
                    >
                      {(ADMIN_SUBCATEGORIES[editCategory] || ['ALL']).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editCategory === 'EARRINGS' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '6px' }}>Earring Sub-Type</label>
                    <select
                      value={editEarringType}
                      onChange={(e) => setEditEarringType(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: '6px' }}
                    >
                      {ADMIN_SUBCATEGORIES['EARRINGS'].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '6px' }}>Gold Purity / Metal</label>
                    <select
                      value={editPurity}
                      onChange={(e) => setEditPurity(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: '6px' }}
                    >
                      <option value="18K Hallmarked Gold">18K Hallmarked Gold</option>
                      <option value="22K Hallmarked Gold">22K Hallmarked Gold</option>
                      <option value="24K Pure Gold">24K Pure Gold</option>
                      <option value="925 Sterling Silver">925 Sterling Silver</option>
                      <option value="VVS-EF Diamond">VVS-EF Diamond</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '6px' }}>Price (₹ Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 45000"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#0d0d0d', border: '1px solid #333', color: '#fff', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '0.85rem', marginBottom: '8px' }}>Product Image</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
                    {editImageUrl && (
                      <img
                        src={editImageUrl}
                        alt="Preview"
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #444' }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/*,.heic,.heif"
                        onChange={handleEditProductFileChange}
                        style={{ color: '#aaa', fontSize: '0.85rem' }}
                      />
                      <div style={{ fontSize: '0.75rem', color: '#777', marginTop: '4px' }}>
                        Leave blank to keep existing image. Supports JPG, PNG, HEIC iPhone photos.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #2a2a2a', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      background: '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 18px',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingEdit}
                    style={{
                      background: 'var(--royal-gold)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 22px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      cursor: savingEdit ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {savingEdit ? 'Saving Changes...' : 'Save & Sync Globally'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. STORE SETTINGS (UPI & QR) */}

        <div style={{ background: '#161616', padding: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', marginBottom: '30px', display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
          
          {/* UPI */}
          <div style={{ flex: '1 1 320px' }}>
            <h3 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.25rem', marginBottom: '14px' }}>
              Official Store UPI
            </h3>
            <form onSubmit={handleUpiUpdate} style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#888', marginBottom: '6px', fontSize: '0.82rem' }}>UPI ID for Customer Payments</label>
                <input 
                  type="text" 
                  value={storeUpi} 
                  onChange={(e) => setStoreUpi(e.target.value)} 
                  required 
                  style={{ padding: '12px', width: '100%', background: '#0a0a0a', border: '1px solid #333', color: '#fff', outline: 'none', borderRadius: '4px', boxSizing: 'border-box' }} 
                />
              </div>
              <button 
                type="submit" 
                disabled={updatingUpi} 
                style={{ padding: '12px 18px', background: 'var(--royal-gold)', color: '#fff', border: 'none', fontWeight: 'bold', textTransform: 'uppercase', cursor: updatingUpi ? 'not-allowed' : 'pointer', borderRadius: '4px', fontSize: '0.82rem' }}
              >
                {updatingUpi ? 'Saving...' : 'Save'}
              </button>
            </form>
          </div>

          {/* QR */}
          <div style={{ flex: '1 1 320px' }}>
            <h3 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.25rem', marginBottom: '14px' }}>
              Showroom Payment QR Code
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleQrUpload} 
                disabled={qrUploading} 
                style={{ color: '#fff', background: '#0a0a0a', padding: '10px', border: '1px solid #333', flex: 1, borderRadius: '4px' }} 
              />
              {qrUploading && <span style={{ color: 'var(--royal-gold)', fontSize: '0.82rem' }}>Uploading...</span>}
            </div>
            <p style={{ color: '#666', fontSize: '0.78rem', marginTop: '6px' }}>Upload current showroom UPI QR image</p>
          </div>

        </div>

        {/* 4. SHOWROOM APPOINTMENTS & INQUIRIES */}
        <div style={{ background: '#161616', padding: '28px', borderRadius: '8px', border: '1px solid #2a2a2a' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', margin: 0 }}>
                Customer Appointments & Inquiries
              </h3>
              <p style={{ color: '#888', margin: '4px 0 0', fontSize: '0.85rem' }}>
                Total received: {inquiries.length} inquiries
              </p>
            </div>

            <input 
              type="text" 
              placeholder="Search by name, phone, branch..." 
              value={searchInquiry}
              onChange={(e) => setSearchInquiry(e.target.value)}
              style={{ padding: '10px 16px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', outline: 'none', borderRadius: '4px', width: '280px' }}
            />
          </div>

          {loading ? (
            <p style={{ color: '#888' }}>Loading inquiries...</p>
          ) : filteredInquiries.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', background: '#0d0d0d', borderRadius: '4px' }}>
              <p style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>No inquiries found.</p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>Appointments submitted on the website will appear here in real time.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filteredInquiries.map((inq, idx) => (
                <div 
                  key={inq.id || idx} 
                  style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', padding: '20px', borderRadius: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <strong style={{ color: '#ffffff', fontSize: '1.15rem' }}>
                        {inq.name || 'Anonymous Customer'}
                      </strong>
                      <span style={{ color: '#777', fontSize: '0.75rem' }}>
                        {inq.created_at ? new Date(inq.created_at).toLocaleString() : inq.date || ''}
                      </span>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <a 
                        href={`tel:${inq.phone}`} 
                        style={{ color: 'var(--royal-gold)', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        📞 {inq.phone || 'No phone'}
                      </a>
                    </div>

                    {inq.branch && (
                      <div style={{ color: '#bbb', fontSize: '0.85rem', marginBottom: '6px' }}>
                        <span style={{ color: '#666' }}>Preferred Branch:</span> <strong>{inq.branch}</strong>
                      </div>
                    )}

                    {(inq.inquiry_type || inq.category) && (
                      <div style={{ color: '#bbb', fontSize: '0.85rem', marginBottom: '6px' }}>
                        <span style={{ color: '#666' }}>Type:</span> {inq.inquiry_type || inq.category}
                      </div>
                    )}

                    {(inq.notes || inq.message) && (
                      <div style={{ color: '#ddd', fontSize: '0.85rem', marginTop: '12px', padding: '10px 12px', background: '#161616', borderRadius: '4px', borderLeft: '3px solid var(--royal-gold)', fontStyle: 'italic', lineHeight: '1.4' }}>
                        "{inq.notes || inq.message}"
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #222' }}>
                    <a 
                      href={`https://wa.me/91${String(inq.phone || '').replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(inq.name || 'Customer')},%20greetings%20from%20SHREE%20ARADHNA%20JEWELLERS!`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '6px 12px', background: '#25D366', color: '#fff', textDecoration: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}
                    >
                      💬 WhatsApp
                    </a>

                    <button 
                      onClick={() => handleDeleteInquiry(inq.id)}
                      style={{ background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', borderRadius: '4px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* 5. REGISTERED CUSTOMERS & RATE ACCESS MEMBERS */}
        <div style={{ background: '#161616', padding: '28px', borderRadius: '8px', border: '1px solid #2a2a2a', marginTop: '30px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ color: 'var(--royal-gold)', fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>👥</span> Registered Customers & Rate Members
              </h3>
              <p style={{ color: '#888', margin: '4px 0 0', fontSize: '0.85rem' }}>
                Total registered members: <strong style={{ color: 'var(--royal-gold)' }}>{customUsers.length}</strong> (accounts created to unlock showroom rates)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select
                value={filterUserBranch}
                onChange={(e) => setFilterUserBranch(e.target.value)}
                style={{ padding: '10px 14px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', outline: 'none', borderRadius: '4px' }}
              >
                <option value="ALL">All Branches</option>
                <option value="Gandhidham">Gandhidham</option>
                <option value="Adipur">Adipur</option>
              </select>

              <input 
                type="text" 
                placeholder="Search by name, phone, email..." 
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                style={{ padding: '10px 16px', background: '#0a0a0a', border: '1px solid #333', color: '#fff', outline: 'none', borderRadius: '4px', width: '260px' }}
              />

              <button
                type="button"
                onClick={fetchCustomUsers}
                style={{ padding: '10px 16px', background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                title="Refresh customer list"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {loadingUsers ? (
            <p style={{ color: '#888' }}>Loading customer list...</p>
          ) : filteredCustomers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', background: '#0d0d0d', borderRadius: '4px' }}>
              <p style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>No customers found.</p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>Registered customers from the website will appear here in real time.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filteredCustomers.map(cust => (
                <div key={cust.id} style={{ background: '#0d0d0d', padding: '20px', borderRadius: '8px', border: '1px solid #222', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ color: '#fff', fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                        {cust.full_name || 'Customer'}
                      </h4>
                      <span style={{ 
                        fontSize: '0.72rem', 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        background: 'rgba(218, 165, 32, 0.15)', 
                        color: 'var(--royal-gold)', 
                        border: '1px solid rgba(218, 165, 32, 0.3)' 
                      }}>
                        {cust.preferred_branch || 'Gandhidham'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                      <div style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📱</span>
                        <strong style={{ color: '#fff' }}>{cust.phone_number || 'N/A'}</strong>
                      </div>

                      <div style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: '8px', wordBreak: 'break-all' }}>
                        <span>✉️</span>
                        <span>{cust.email?.endsWith('@customer.saj') ? '(No email provided)' : cust.email}</span>
                      </div>

                      <div style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🔑</span>
                        <span>Password: <code style={{ background: '#1c1c1c', padding: '2px 6px', borderRadius: '4px', color: '#ffd700' }}>{cust.password}</code></span>
                      </div>

                      <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '4px' }}>
                        Registered: {cust.created_at ? new Date(cust.created_at).toLocaleString('en-IN') : 'N/A'}
                      </div>
                    </div>

                    {/* Inline Reset Password Form */}
                    {editingUserId === cust.id && (
                      <div style={{ marginTop: '14px', padding: '12px', background: '#181818', borderRadius: '6px', border: '1px solid #333' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#ccc', marginBottom: '6px' }}>
                          Set New Password for {cust.full_name}:
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="New password"
                            value={newPasswordVal}
                            onChange={(e) => setNewPasswordVal(e.target.value)}
                            style={{ flex: 1, padding: '7px 10px', background: '#0a0a0a', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}
                          />
                          <button
                            type="button"
                            disabled={savingUserPassword}
                            onClick={() => handleResetUserPassword(cust.id, cust.full_name || 'Customer')}
                            style={{ padding: '7px 12px', background: 'var(--royal-gold)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingUserId(null); setNewPasswordVal(''); }}
                            style={{ padding: '7px 10px', background: '#333', color: '#aaa', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #222', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a 
                        href={'https://wa.me/91' + String(cust.phone_number || '').replace(/\D/g, '').slice(-10) + '?text=Hello%20' + encodeURIComponent(cust.full_name || 'Customer') + ',%20greetings%20from%20SHREE%20ARADHNA%20JEWELLERS!'}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: '6px 12px', background: '#25D366', color: '#fff', textDecoration: 'none', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        WhatsApp
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserId(editingUserId === cust.id ? null : cust.id);
                          setNewPasswordVal('');
                        }}
                        style={{ padding: '5px 10px', background: 'transparent', color: 'var(--royal-gold)', border: '1px solid var(--royal-gold)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                      >
                        Reset Password
                      </button>
                    </div>

                    <button 
                      onClick={() => handleDeleteCustomer(cust.id, cust.full_name || 'Customer')}
                      style={{ background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', borderRadius: '4px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
