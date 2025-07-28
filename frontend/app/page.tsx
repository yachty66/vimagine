"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Play, ArrowUp, Video, Plus, Edit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle, getCurrentUser, signOut } from "@/lib/auth";
import supabase from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// Custom X (formerly Twitter) icon component
const XIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Project interface
interface Project {
  id: number;
  name: string;
  created_at: string;
  user_id: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");

  // Check if user is already logged in and listen for auth changes
  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    // Listen for auth state changes (when user returns from Google OAuth)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        setIsLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setProjects([]); // Clear projects when user signs out
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user's projects when user is available
  useEffect(() => {
    if (user) {
      loadUserProjects();
    }
  }, [user]);

  // Function to load user's projects from Supabase
  const loadUserProjects = async () => {
    if (!user) return;

    setIsLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading projects:", error);
        return;
      }

      setProjects(data || []);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return "Created today";
    } else if (diffInDays === 1) {
      return "Created yesterday";
    } else if (diffInDays < 7) {
      return `Created ${diffInDays} days ago`;
    } else {
      return `Created ${date.toLocaleDateString()}`;
    }
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert("Failed to sign in. Please try again.");
    }
  };

  const handleGetStarted = async () => {
    try {
      if (user) {
        // User is already logged in, create a new project
        await handleNewProject();
      } else {
        // Sign up with Google
        await signInWithGoogle();
      }
    } catch (error) {
      alert("Failed to get started. Please try again.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setProjects([]);
    } catch (error) {
      alert("Failed to sign out. Please try again.");
    }
  };

  // Handle creating a new project
  const handleNewProject = async () => {
    if (!user) {
      handleGetStarted();
      return;
    }

    try {
      // Create a new project in the database
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: "untitled_project",
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating project:", error);
        alert("Failed to create project. Please try again.");
        return;
      }

      // Navigate to main page with the new project ID
      router.push(`/main?projectId=${data.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project. Please try again.");
    }
  };

  // Handle clicking on an existing project
  const handleProjectClick = (project: Project) => {
    router.push(`/main?projectId=${project.id}`);
  };

  // Get user's profile picture URL
  const getProfilePictureUrl = (user: User) => {
    // Try to get Google profile picture from user metadata
    const avatarUrl =
      user.user_metadata?.avatar_url || user.user_metadata?.picture;
    return avatarUrl;
  };

  // Function to delete a project
  const handleDeleteProject = async (
    project: Project,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // Prevent card click when clicking delete button

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id)
        .eq("user_id", user?.id); // Extra security check

      if (error) {
        console.error("Error deleting project:", error);
        alert("Failed to delete project. Please try again.");
        return;
      }

      // Remove project from local state
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project. Please try again.");
    }
  };

  // Function to start editing a project name
  const handleStartEdit = (project: Project, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click when clicking edit button
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  // Function to save edited project name
  const handleSaveEdit = async (projectId: number) => {
    if (!editingProjectName.trim()) {
      alert("Project name cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: editingProjectName.trim() })
        .eq("id", projectId)
        .eq("user_id", user?.id); // Extra security check

      if (error) {
        console.error("Error updating project:", error);
        alert("Failed to update project name. Please try again.");
        return;
      }

      // Update project in local state
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, name: editingProjectName.trim() } : p
        )
      );

      // Exit edit mode
      setEditingProjectId(null);
      setEditingProjectName("");
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Failed to update project name. Please try again.");
    }
  };

  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditingProjectName("");
  };

  // Handle key press in edit input
  const handleEditKeyPress = (
    event: React.KeyboardEvent,
    projectId: number
  ) => {
    if (event.key === "Enter") {
      handleSaveEdit(projectId);
    } else if (event.key === "Escape") {
      handleCancelEdit();
    }
  };

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
              {isLoading ? (
                <div className="w-8 h-8 bg-white/10 rounded-full animate-pulse"></div>
              ) : user ? (
                <div className="flex items-center space-x-3">
                  {/* User Profile Picture */}
                  <div className="relative group">
                    <img
                      src={
                        getProfilePictureUrl(user) ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.email || "User"
                        )}&background=ffffff&color=000000`
                      }
                      alt="Profile"
                      className="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-white/50 transition-all"
                      onClick={() => {
                        // Show a small dropdown or menu on click
                        const confirmSignOut = window.confirm(
                          "Do you want to sign out?"
                        );
                        if (confirmSignOut) {
                          handleSignOut();
                        }
                      }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-white text-black text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {user.email}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-black hover:bg-white"
                    onClick={handleSignIn}
                  >
                    Log in
                  </Button>
                  <Button
                    size="sm"
                    className="bg-white text-black hover:bg-white/90"
                    onClick={handleGetStarted}
                  >
                    Get started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Minimal Hero Section */}
      <main className="max-w-4xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            Imagine something
            <span className="text-white"> unique</span>
          </h1>
          <p className="text-lg text-white/70 mb-12 max-w-2xl mx-auto">
            Create videos by chatting with AI
          </p>

          {/* Pure Black & White Input */}
          <div className="max-w-xl mx-auto mb-16">
            <div className="relative bg-black rounded-xl border border-white/30 p-4">
              <div className="flex items-center space-x-3">
                <Input
                  placeholder={
                    user
                      ? "Describe your video idea..."
                      : "Sign in to create videos..."
                  }
                  className="flex-1 border-0 text-base placeholder:text-white/50 focus-visible:ring-0 bg-transparent text-white"
                  disabled={!user}
                />
                <Button
                  size="icon"
                  className="bg-white hover:bg-white/90 text-black rounded-lg w-10 h-10 shrink-0"
                  onClick={() => {
                    if (!user) {
                      handleGetStarted();
                    } else {
                      // Navigate to main page for video creation
                      handleNewProject();
                    }
                  }}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* My Projects Section - Only show when authenticated */}
      {user && (
        <section className="max-w-7xl mx-auto px-6 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">My Projects</h2>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white hover:text-black"
              onClick={handleNewProject}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>

          {/* Projects Grid */}
          {isLoadingProjects ? (
            <div className="grid grid-cols-4 gap-4">
              {/* Loading skeleton */}
              {Array.from({ length: 4 }, (_, i) => (
                <Card
                  key={i}
                  className="bg-black border-white/20 animate-pulse"
                >
                  <CardContent className="p-3">
                    <div className="aspect-video bg-white/5 rounded-lg border border-white/10"></div>
                    <div className="mt-2">
                      <div className="h-4 bg-white/10 rounded mb-1"></div>
                      <div className="h-3 bg-white/5 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-4 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group hover:border-white transition-colors bg-black border-white/20 cursor-pointer relative"
                  onClick={() =>
                    editingProjectId !== project.id &&
                    handleProjectClick(project)
                  }
                >
                  <CardContent className="p-3">
                    {/* Action buttons - show on hover */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 bg-black/60 hover:bg-zinc-800 text-white/70 hover:text-white"
                        onClick={(e) => handleStartEdit(project, e)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 bg-black/60 hover:bg-zinc-700 text-white/70 hover:text-white"
                        onClick={(e) => handleDeleteProject(project, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="aspect-video bg-white/5 rounded-lg relative overflow-hidden border border-white/10">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Video className="w-8 h-8 text-white/40 mx-auto mb-2" />
                          <p className="text-xs text-white/60">
                            {project.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      {editingProjectId === project.id ? (
                        // Edit mode
                        <div className="space-y-2">
                          <Input
                            value={editingProjectName}
                            onChange={(e) =>
                              setEditingProjectName(e.target.value)
                            }
                            onKeyDown={(e) => handleEditKeyPress(e, project.id)}
                            className="text-sm bg-zinc-800 border-zinc-600 text-white"
                            autoFocus
                            onBlur={() => handleSaveEdit(project.id)}
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-6 px-2 text-xs bg-white text-black hover:bg-white/90"
                              onClick={() => handleSaveEdit(project.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs text-white/60 hover:text-white/80"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <>
                          <h3 className="text-sm font-medium text-white/80 truncate">
                            {project.name}
                          </h3>
                          <p className="text-xs text-white/50 mt-1">
                            {formatDate(project.created_at)}
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Empty state when no projects - simplified
            <div className="text-center py-16">
              <p className="text-white/60 text-lg">No projects found</p>
            </div>
          )}
        </section>
      )}

      {/* From the Community Section */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">
          From the Community
        </h2>

        {/* 4x4 Grid of Community Placeholders */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 16 }, (_, i) => (
            <Card
              key={i}
              className="group hover:border-white transition-colors bg-black border-white/20 cursor-pointer"
            >
              <CardContent className="p-3">
                <div className="aspect-video bg-white/10 rounded-lg relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white/60 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

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
            <Link
              href="https://x.com/unitedcompute"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
