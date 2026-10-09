import React, { useState, useEffect, useMemo } from 'react';
import { TravelMemory, User, NotificationItem } from './types/travel';
import {
  getStoredMemories,
  saveStoredMemories,
  getStoredUser,
  saveStoredUser,
  getStoredNotifications,
  saveStoredNotifications,
  getStoredBookmarks,
  toggleStoredBookmark,
  getOfflineQueue,
  addToOfflineQueue,
  clearOfflineQueue,
  getStoredTheme,
  saveStoredTheme,
  playHapticSound,
} from './utils/storage';
import { DEMO_EXPLORERS, INITIAL_MEMORIES } from './data/initialData';

import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { SearchAndFilter } from './components/SearchAndFilter';
import { NewMemorySidebar } from './components/NewMemorySidebar';
import { MemoryCard } from './components/MemoryCard';
import { MemoryDetailModal } from './components/MemoryDetailModal';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { NotificationDropdown } from './components/NotificationDropdown';
import { OfflineBanner } from './components/OfflineBanner';

import { Sparkles, Compass, MapPin, Heart, MessageSquare, AlertCircle, CheckCircle, Wifi, Users } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [memories, setMemories] = useState<TravelMemory[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState(getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState(false);

  // Active view & filters
  const [activeView, setActiveView] = useState<'feed' | 'itineraries' | 'saved'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('All Styles');

  // Modals & Panels
  const [selectedMemory, setSelectedMemory] = useState<TravelMemory | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileNewMemoryOpen, setIsMobileNewMemoryOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type?: 'info' | 'success' | 'alert' } | null>(null);

  // Initialize data on mount
  useEffect(() => {
    const savedTheme = getStoredTheme();
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    setCurrentUser(getStoredUser());
    setMemories(getStoredMemories());
    setBookmarks(getStoredBookmarks());
    setNotifications(getStoredNotifications());
    setOfflineQueue(getOfflineQueue());

    // Listen to browser network changes
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Online connection restored', 'You can now synchronize any offline-saved drafts.', 'success');
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Remote offline mode active', 'All cached memories and itineraries are accessible offline.', 'alert');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = (title: string, desc: string, type: 'info' | 'success' | 'alert' = 'info') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.title === title ? null : prev));
    }, 4500);
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    saveStoredTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Toggle Offline Simulator
  const handleToggleOffline = () => {
    const next = !isOffline;
    setIsOffline(next);
    if (next) {
      showToast('Switched to Remote Mode', 'Simulating offline experience in remote mountains or deserts.', 'alert');
    } else {
      showToast('Reconnected to Network', 'Back online. Ready to sync with fellow explorers.', 'success');
    }
  };

  // Handle Likes
  const handleLike = (memoryId: string) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const updated = memories.map((m) => {
      if (m.id === memoryId) {
        const hasLiked = m.likes.includes(currentUser.id);
        const newLikes = hasLiked
          ? m.likes.filter((uid) => uid !== currentUser.id)
          : [...m.likes, currentUser.id];

        // Trigger notification for the author if not liking own memory
        if (!hasLiked && m.author.id !== currentUser.id) {
          const newNotif: NotificationItem = {
            id: `notif_${Date.now()}`,
            type: 'like',
            actor: {
              name: currentUser.name,
              avatar: currentUser.avatar,
            },
            memoryId: m.id,
            memoryTitle: m.title,
            message: `liked your scrapbook memory "${m.title}"`,
            createdAt: 'Just now',
            read: false,
          };
          const nextNotifs = [newNotif, ...notifications];
          setNotifications(nextNotifs);
          saveStoredNotifications(nextNotifs);
        }

        return { ...m, likes: newLikes };
      }
      return m;
    });

    setMemories(updated);
    saveStoredMemories(updated);

    if (selectedMemory && selectedMemory.id === memoryId) {
      const currentSelected = updated.find((m) => m.id === memoryId);
      if (currentSelected) setSelectedMemory(currentSelected);
    }
  };

  // Handle Bookmarks (Offline saving)
  const handleToggleBookmark = (memoryId: string) => {
    const updated = toggleStoredBookmark(memoryId);
    setBookmarks(updated);
    const isNowBookmarked = updated.includes(memoryId);
    if (isNowBookmarked) {
      showToast('Saved for Offline Access', 'Itinerary and photos cached for remote travel without network.', 'success');
    } else {
      showToast('Removed from Saved', 'Memory removed from offline collection.');
    }
  };

  // Handle Post Memory
  const handlePostMemory = (memoryData: Partial<TravelMemory>) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const newMemory: TravelMemory = {
      id: `mem_${Date.now()}`,
      title: memoryData.title || 'Untitled Memory',
      description: memoryData.description || '',
      photoUrl: memoryData.photoUrl || '',
      photoCaption: memoryData.photoCaption,
      location: memoryData.location || 'Unknown Road',
      country: memoryData.country || 'Global',
      travelStyle: memoryData.travelStyle || 'Slow Travel',
      tags: memoryData.tags || ['travel'],
      author: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        email: currentUser.email,
      },
      createdAt: 'JUST NOW',
      likes: [],
      comments: [],
      itinerary: memoryData.itinerary,
      isOfflineCached: true,
      isPendingSync: isOffline,
    };

    const nextMemories = [newMemory, ...memories];
    setMemories(nextMemories);
    saveStoredMemories(nextMemories);

    if (isOffline) {
      addToOfflineQueue({
        id: `queue_${Date.now()}`,
        type: 'post_memory',
        payload: newMemory,
        timestamp: Date.now(),
      });
      setOfflineQueue(getOfflineQueue());
      showToast('Saved in Offline Drafts', 'Memory saved to device. Will upload once connected.', 'alert');
    } else {
      showToast('Memory Pinned to Scrapbook', 'Fellow explorers can now discover your journey and itinerary.', 'success');
    }

    if (isMobileNewMemoryOpen) {
      setIsMobileNewMemoryOpen(false);
    }
  };

  // Handle Add Comment
  const handleAddComment = (memoryId: string, text: string) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const newComment = {
      id: `c_${Date.now()}`,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
      },
      text,
      createdAt: 'Just now',
    };

    const updated = memories.map((m) => {
      if (m.id === memoryId) {
        // Notification for memory author
        if (m.author.id !== currentUser.id) {
          const newNotif: NotificationItem = {
            id: `notif_${Date.now()}`,
            type: 'comment',
            actor: {
              name: currentUser.name,
              avatar: currentUser.avatar,
            },
            memoryId: m.id,
            memoryTitle: m.title,
            message: `commented: "${text.length > 50 ? text.slice(0, 50) + '...' : text}"`,
            createdAt: 'Just now',
            read: false,
          };
          const nextNotifs = [newNotif, ...notifications];
          setNotifications(nextNotifs);
          saveStoredNotifications(nextNotifs);
        }

        return {
          ...m,
          comments: [...m.comments, newComment],
        };
      }
      return m;
    });

    setMemories(updated);
    saveStoredMemories(updated);

    if (selectedMemory && selectedMemory.id === memoryId) {
      const curr = updated.find((m) => m.id === memoryId);
      if (curr) setSelectedMemory(curr);
    }

    if (isOffline) {
      addToOfflineQueue({
        id: `queue_${Date.now()}`,
        type: 'post_comment',
        payload: { memoryId, comment: newComment },
        timestamp: Date.now(),
      });
      setOfflineQueue(getOfflineQueue());
      showToast('Comment Queued Offline', 'Will publish once network connection is re-established.', 'alert');
    }
  };

  // Sync Offline Queue
  const handleSyncNow = () => {
    setIsSyncing(true);
    playHapticSound('post');

    setTimeout(() => {
      // Clear pending indicators from memories
      const syncedMemories = memories.map((m) => ({ ...m, isPendingSync: false }));
      setMemories(syncedMemories);
      saveStoredMemories(syncedMemories);

      const count = offlineQueue.length;
      clearOfflineQueue();
      setOfflineQueue([]);
      setIsSyncing(false);

      showToast('Offline Queue Synchronized', `Successfully synced ${count} item(s) to the community log.`, 'success');
    }, 1200);
  };

  // Mark all notifications read
  const handleMarkAllNotificationsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  // Simulate real-time interaction
  const handleSimulateActivity = () => {
    const randomExplorer = DEMO_EXPLORERS[Math.floor(Math.random() * (DEMO_EXPLORERS.length - 1)) + 1];
    const targetMemory = memories[0] || INITIAL_MEMORIES[0];
    const isComment = Math.random() > 0.5;

    playHapticSound('notification');

    const newNotif: NotificationItem = {
      id: `sim_${Date.now()}`,
      type: isComment ? 'comment' : 'like',
      actor: {
        name: randomExplorer.name,
        avatar: randomExplorer.avatar,
      },
      memoryId: targetMemory.id,
      memoryTitle: targetMemory.title,
      message: isComment
        ? `asked: "How was the local transport reaching ${targetMemory.location}?"`
        : `hearted your travel story "${targetMemory.title}"`,
      createdAt: 'Just now',
      read: false,
    };

    const next = [newNotif, ...notifications];
    setNotifications(next);
    saveStoredNotifications(next);

    showToast(
      `New Community Interaction from ${randomExplorer.name}`,
      newNotif.message,
      'info'
    );
  };

  // Filter logic
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      // Active View
      if (activeView === 'itineraries' && (!m.itinerary || m.itinerary.length === 0)) {
        return false;
      }
      if (activeView === 'saved' && !bookmarks.includes(m.id)) {
        return false;
      }

      // Travel style
      if (selectedStyle !== 'All Styles' && m.travelStyle !== selectedStyle) {
        return false;
      }

      // Destination
      if (selectedDestination && !m.location.toLowerCase().includes(selectedDestination.toLowerCase()) && !m.country.toLowerCase().includes(selectedDestination.toLowerCase())) {
        return false;
      }

      // Tag
      if (selectedTag && !m.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase())) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesDesc = m.description.toLowerCase().includes(q);
        const matchesLoc = m.location.toLowerCase().includes(q);
        const matchesCountry = m.country.toLowerCase().includes(q);
        const matchesAuthor = m.author.name.toLowerCase().includes(q);
        const matchesTag = m.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesCountry && !matchesAuthor && !matchesTag) {
          return false;
        }
      }

      return true;
    });
  }, [memories, activeView, bookmarks, selectedStyle, selectedDestination, selectedTag, searchQuery]);

  const hasActiveFilters = Boolean(searchQuery || selectedTag || selectedDestination || selectedStyle !== 'All Styles');

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTag('');
    setSelectedDestination('');
    setSelectedStyle('All Styles');
  };

  const userMemories = currentUser
    ? memories.filter((m) => m.author.id === currentUser.id)
    : [];

  const savedMemories = memories.filter((m) => bookmarks.includes(m.id));

  return (
    <div className={`min-h-screen font-sans selection:bg-[#FAB76D] selection:text-stone-900 transition-colors ${
      theme === 'dark'
        ? 'bg-[#181B1E] text-stone-100'
        : 'bg-[#F9F7F2] text-stone-900'
    }`}>
      
      {/* Top Navigation */}
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenNewMemory={() => setIsMobileNewMemoryOpen(true)}
        onSelectView={setActiveView}
        activeView={activeView}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
        pendingSyncCount={offlineQueue.length}
      />

      {/* Offline Status & Sync Alert */}
      <OfflineBanner
        isOffline={isOffline}
        pendingSyncCount={offlineQueue.length}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        onGoOnline={() => setIsOffline(false)}
        cachedCount={memories.length}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        
        {/* Scrapbook Hero Banner */}
        <HeroSection
          theme={theme}
          selectedStyle={selectedStyle}
          onSelectStyle={setSelectedStyle}
          totalMemoriesCount={memories.length}
          isOffline={isOffline}
        />

        {/* View Indicator if filtered */}
        {activeView !== 'feed' && (
          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#EF853F]">
              <Compass className="w-4 h-4" />
              <span>
                {activeView === 'itineraries' ? 'Filtered by Day-by-Day Field Itineraries' : 'Offline Saved Travel Guides'}
              </span>
            </div>
            <button
              onClick={() => setActiveView('feed')}
              className="text-xs text-stone-400 hover:text-current underline"
            >
              Show all memories
            </button>
          </div>
        )}

        {/* Two-Column Scrapbook Layout (Matches IMG_5491) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Feed Grid (Col-span 8) */}
          <div className="lg:col-span-8 space-y-6">
            
            {filteredMemories.length === 0 ? (
              <div className={`p-12 text-center rounded-3xl border ${
                theme === 'dark' ? 'bg-[#212429] border-[#2E343B]' : 'bg-white border-[#E8E2D8]'
              }`}>
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-[#FAB76D]/20 text-[#FAB76D] mb-3">
                  <Compass className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-medium mb-1">No matching memories found</h3>
                <p className="text-xs text-stone-400 max-w-sm mx-auto mb-4">
                  Try adjusting your destination or travel style filter, or pin a new memory to the scrapbook.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#FAB76D] text-stone-950 hover:bg-[#EF853F] hover:text-white transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    theme={theme}
                    currentUser={currentUser}
                    onLike={handleLike}
                    onSelect={setSelectedMemory}
                    isBookmarked={bookmarks.includes(memory.id)}
                    onToggleBookmark={handleToggleBookmark}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Search + New Memory Form (Col-span 4) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20">
            
            {/* Search Box - Matches IMG_5491 */}
            <SearchAndFilter
              theme={theme}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedTag={selectedTag}
              onTagChange={setSelectedTag}
              selectedDestination={selectedDestination}
              onDestinationChange={setSelectedDestination}
              onResetFilters={handleResetFilters}
              hasActiveFilters={hasActiveFilters}
            />

            {/* New Memory Widget - Matches IMG_5491 */}
            <NewMemorySidebar
              theme={theme}
              currentUser={currentUser}
              onPostMemory={handlePostMemory}
              isOffline={isOffline}
              onRequireAuth={() => setIsAuthOpen(true)}
            />

            {/* Community Explorers Online Widget */}
            <div className={`p-4 rounded-2xl border text-xs ${
              theme === 'dark' ? 'bg-[#212429] border-[#2E343B]' : 'bg-white border-[#E8E2D8]'
            }`}>
              <div className="flex items-center justify-between mb-3 text-stone-400 font-mono uppercase tracking-wider text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#2C8287]" />
                  Fellow Explorers
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>

              <div className="space-y-2">
                {DEMO_EXPLORERS.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={exp.avatar}
                        alt={exp.name}
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                      />
                      <div className="truncate">
                        <div className="font-semibold text-current truncate">{exp.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono">{exp.travelStyle}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-stone-400 shrink-0">
                      {exp.totalTrips} trips
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Post Detail Modal with Comments (Matches Screenshot in IMG_5491) */}
      <MemoryDetailModal
        memory={selectedMemory}
        onClose={() => setSelectedMemory(null)}
        theme={theme}
        currentUser={currentUser}
        onLike={handleLike}
        onAddComment={handleAddComment}
        isBookmarked={selectedMemory ? bookmarks.includes(selectedMemory.id) : false}
        onToggleBookmark={handleToggleBookmark}
        isOffline={isOffline}
        onRequireAuth={() => setIsAuthOpen(true)}
      />

      {/* Auth Modal (Matches Sign in / Sign up Screenshot in IMG_5491) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        theme={theme}
        onLogin={(user) => {
          setCurrentUser(user);
          saveStoredUser(user);
          showToast(`Welcome back, ${user.name}!`, 'Signed into your travel memory keeper.', 'success');
        }}
      />

      {/* Profile Management Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onUpdateUser={(updated) => {
          setCurrentUser(updated);
          saveStoredUser(updated);
          showToast('Profile Updated', 'Your explorer profile has been refreshed.', 'success');
        }}
        onLogout={() => {
          setCurrentUser(null);
          showToast('Signed Out', 'You are now browsing as an anonymous guest.');
        }}
        theme={theme}
        userMemories={userMemories}
        savedMemories={savedMemories}
        pendingSyncCount={offlineQueue.length}
        onSelectMemory={setSelectedMemory}
      />

      {/* Notifications Dropdown */}
      <NotificationDropdown
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onSelectNotification={(memId) => {
          const m = memories.find((x) => x.id === memId);
          if (m) setSelectedMemory(m);
        }}
        theme={theme}
        onSimulateActivity={handleSimulateActivity}
      />

      {/* Mobile Modal for New Memory */}
      {isMobileNewMemoryOpen && (
        <div className="fixed inset-0 z-50 p-4 bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-lg relative my-auto">
            <button
              onClick={() => setIsMobileNewMemoryOpen(false)}
              className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-stone-800 text-white shadow-lg"
            >
              ✕
            </button>
            <NewMemorySidebar
              theme={theme}
              currentUser={currentUser}
              onPostMemory={handlePostMemory}
              isOffline={isOffline}
              onRequireAuth={() => {
                setIsMobileNewMemoryOpen(false);
                setIsAuthOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Tactile Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all animate-in slide-in-from-bottom-3 duration-200 bg-[#1C1F23]/95 text-stone-100 border-stone-700">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {toastMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {toastMessage.type === 'alert' && <AlertCircle className="w-4 h-4 text-[#EF853F]" />}
              {toastMessage.type === 'info' && <Sparkles className="w-4 h-4 text-[#FAB76D]" />}
            </div>
            <div className="flex-1 text-xs">
              <p className="font-semibold text-white">{toastMessage.title}</p>
              <p className="mt-0.5 text-stone-300 leading-relaxed text-[11px]">{toastMessage.desc}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-stone-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
