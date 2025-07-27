"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Loader2,
  Video,
  Calendar,
  Edit2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import supabase from "@/lib/supabase";

interface Project {
  id: number;
  name: string;
  created_at: string;
  user_id: string;
}

export default function VideoEditorPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit state
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete state
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(
    null
  );

  // Load user's projects on component mount
  useEffect(() => {
    loadUserProjects();
  }, []);

  const loadUserProjects = async () => {
    try {
      setIsLoadingProjects(true);
      setLoadError(null);

      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.log("Auth error:", authError);
        throw new Error("User not authenticated");
      }

      console.log("User ID:", user.id);

      // Fetch user's projects - order by created_at since updated_at doesn't exist
      const { data: userProjects, error: fetchError } = await supabase
        .from("ai_video_editor_projects")
        .select("id, name, created_at, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Log detailed error information
      if (fetchError) {
        console.error("Supabase fetch error:", {
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code,
        });
        throw new Error(`Database error: ${fetchError.message}`);
      }

      console.log("Fetched projects:", userProjects);
      setProjects(userProjects || []);
    } catch (error) {
      console.error("Failed to load projects:", error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to load projects"
      );
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleCreateNew = async () => {
    setIsCreating(true);

    try {
      // Add minimum loading time so user sees feedback
      const [projectResult] = await Promise.all([
        // Create project
        (async () => {
          // Get current user
          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser();

          if (authError || !user) {
            throw new Error("User not authenticated");
          }

          // Insert directly into Supabase
          const { data: project, error: insertError } = await supabase
            .from("ai_video_editor_projects")
            .insert({
              name: "untitled_project",
              user_id: user.id,
            })
            .select("id, name, created_at, user_id")
            .single();

          if (insertError) {
            console.error("Insert error:", {
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              code: insertError.code,
            });
            throw new Error(`Failed to create project: ${insertError.message}`);
          }

          return project;
        })(),
        // Minimum loading time of 800ms for user feedback
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);

      // Add to local state
      setProjects((prev) => [projectResult, ...prev]);

      // Store project data and navigate
      localStorage.setItem("currentProjectId", projectResult.id.toString());
      localStorage.setItem("currentProjectName", projectResult.name);

      router.push("/inference/editor/main");
    } catch (error) {
      console.error("Failed to create project:", error);
      alert(
        `Failed to create project: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsCreating(false);
    }
  };

  const handleOpenProject = (project: Project) => {
    // Don't open if we're editing or deleting
    if (editingProjectId === project.id || deletingProjectId === project.id)
      return;

    // Store project data and navigate
    localStorage.setItem("currentProjectId", project.id.toString());
    localStorage.setItem("currentProjectName", project.name);
    router.push("/inference/editor/main");
  };

  // Start editing a project name
  const startEditProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the project
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  // Cancel editing
  const cancelEditProject = () => {
    setEditingProjectId(null);
    setEditingName("");
  };

  // Save edited project name
  const saveEditProject = async () => {
    if (!editingName.trim() || !editingProjectId) {
      cancelEditProject();
      return;
    }

    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("ai_video_editor_projects")
        .update({ name: editingName.trim() })
        .eq("id", editingProjectId);

      if (error) {
        throw error;
      }

      // Update local state
      setProjects((prev) =>
        prev.map((project) =>
          project.id === editingProjectId
            ? { ...project, name: editingName.trim() }
            : project
        )
      );

      // Update localStorage if this is the current project
      const currentProjectId = localStorage.getItem("currentProjectId");
      if (currentProjectId === editingProjectId.toString()) {
        localStorage.setItem("currentProjectName", editingName.trim());
      }

      setEditingProjectId(null);
      setEditingName("");
    } catch (error) {
      console.error("Failed to update project name:", error);
      alert("Failed to update project name");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle key press for editing
  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditProject();
    } else if (e.key === "Escape") {
      cancelEditProject();
    }
  };

  // Delete a project
  const deleteProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the project

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setDeletingProjectId(project.id);
    try {
      // Delete associated media files first
      await supabase
        .from("ai_editor_media_files")
        .delete()
        .eq("project_id", project.id);

      // Delete the project
      const { error } = await supabase
        .from("ai_video_editor_projects")
        .delete()
        .eq("id", project.id);

      if (error) {
        throw error;
      }

      // Remove from local state
      setProjects((prev) => prev.filter((p) => p.id !== project.id));

      // Clear localStorage if this was the current project
      const currentProjectId = localStorage.getItem("currentProjectId");
      if (currentProjectId === project.id.toString()) {
        localStorage.removeItem("currentProjectId");
        localStorage.removeItem("currentProjectName");
      }

      console.log("Project deleted successfully:", project.name);
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Failed to delete project");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoadingProjects) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-zinc-400" />
            <p className="text-zinc-400">Loading your projects...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen bg-zinc-950 text-white flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-red-400 mb-4">{loadError}</p>
            <button
              onClick={loadUserProjects}
              className="text-white hover:text-zinc-300 underline mb-4"
            >
              Try again
            </button>
            <div className="text-xs text-zinc-500 mt-4">
              <p>Check the browser console for detailed error information</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col">
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Video Projects</h1>
          <p className="text-zinc-400">
            {projects.length === 0
              ? "Create your first video project with AI assistance"
              : `You have ${projects.length} project${
                  projects.length === 1 ? "" : "s"
                }`}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create New Card */}
          <Card
            className={`bg-zinc-800 border-zinc-700 transition-all duration-200 cursor-pointer group ${
              isCreating
                ? "opacity-75 cursor-not-allowed scale-95"
                : "hover:bg-zinc-750 hover:scale-[1.02]"
            }`}
            onClick={isCreating ? undefined : handleCreateNew}
          >
            <div className="aspect-video flex flex-col items-center justify-center p-6">
              <div
                className={`w-12 h-12 bg-zinc-700 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 ${
                  isCreating ? "bg-zinc-600" : "group-hover:bg-zinc-600"
                }`}
              >
                {isCreating ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Plus className="w-6 h-6 text-zinc-400" />
                )}
              </div>
              <h3 className="text-sm font-medium text-white mb-1">
                {isCreating ? "Creating..." : "Create New"}
              </h3>
              <p className="text-xs text-zinc-400 text-center">
                {isCreating
                  ? "Setting up project..."
                  : "Start a new video project"}
              </p>
            </div>
          </Card>

          {/* Existing Projects */}
          {projects.map((project) => (
            <Card
              key={project.id}
              className="bg-zinc-800 border-zinc-700 hover:bg-zinc-750 transition-all duration-200 cursor-pointer group hover:scale-[1.02] relative"
              onClick={() => handleOpenProject(project)}
            >
              {/* Action buttons - show on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                <Button
                  onClick={(e) => startEditProject(project, e)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 hover:text-white"
                  disabled={deletingProjectId === project.id}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  onClick={(e) => deleteProject(project, e)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 bg-zinc-700/80 hover:bg-red-600 text-zinc-300 hover:text-white"
                  disabled={
                    editingProjectId === project.id ||
                    deletingProjectId === project.id
                  }
                >
                  {deletingProjectId === project.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                </Button>
              </div>

              <div className="aspect-video flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-3 group-hover:bg-zinc-200 transition-colors">
                  <Video className="w-6 h-6 text-zinc-900" />
                </div>

                {/* Project name - editable */}
                {editingProjectId === project.id ? (
                  <div className="flex items-center gap-1 mb-1 w-full">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleEditKeyPress}
                      className="bg-zinc-700 border-zinc-600 text-white text-sm h-6 px-2 text-center"
                      autoFocus
                      disabled={isSavingEdit}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveEditProject();
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
                      disabled={isSavingEdit}
                    >
                      {isSavingEdit ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditProject();
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      disabled={isSavingEdit}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <h3 className="text-sm font-medium text-white mb-1 text-center line-clamp-1">
                    {project.name}
                  </h3>
                )}

                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(project.created_at)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center mt-12">
            <Video className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-500 mb-2">No projects yet</p>
            <p className="text-zinc-400 text-sm">
              Create your first video project to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}