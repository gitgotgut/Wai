"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function ExtensionsPage() {
  const utils = trpc.useUtils();
  const { data: syncStatus, isLoading } = trpc.sync.status.useQuery();
  const generateToken = trpc.sync.generateToken.useMutation({
    onSuccess: () => {
      utils.sync.status.invalidate();
    },
  });
  const revokeDevice = trpc.sync.revokeDevice.useMutation({
    onSuccess: () => {
      utils.sync.status.invalidate();
    },
  });

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");

  async function handleGenerateToken(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    try {
      // In a real extension, the deviceId would be generated once and stored
      const deviceId = crypto.randomUUID();
      await generateToken.mutateAsync({
        deviceId,
        deviceName: newDeviceName,
        extensionVersion: "1.0.0", // Would come from extension manifest
      });
      setNewDeviceName("");
      setShowTokenModal(false);
    } catch (error) {
      console.error("Failed to generate token:", error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timeSinceSync = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Extensions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your VS Code extension devices. Each device syncs its local coding stats.
        </p>
      </div>

      {/* Add Device Button */}
      <div>
        <button
          onClick={() => setShowTokenModal(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add New Device
        </button>
      </div>

      {/* Device List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Registered Devices ({syncStatus?.totalDevices || 0})
        </h2>

        {isLoading && <p className="text-sm text-gray-500">Loading devices...</p>}

        {syncStatus?.devices?.length === 0 && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900">
            No devices registered yet. Add a device to start syncing your extension stats.
          </p>
        )}

        {syncStatus?.devices?.map((device) => (
          <div
            key={device.deviceId}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 11a2 2 0 00-2 2v2a2 2 0 002 2h10a2 2 0 002-2v-2a2 2 0 00-2-2H5z" />
                </svg>
                <span className="font-semibold">{device.deviceName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>v{device.extensionVersion}</span>
                <span>Added {formatDate(device.createdAt)}</span>
              </div>
              <div className="text-xs text-green-600">
                Last sync: {timeSinceSync(device.lastSyncAt)}
              </div>
            </div>
            <button
              onClick={() => revokeDevice.mutate({ deviceId: device.deviceId })}
              disabled={revokeDevice.isPending}
              className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              {revokeDevice.isPending ? "Removing..." : "Remove"}
            </button>
          </div>
        ))}
      </div>

      {/* Token Generation Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-950">
            <h2 className="text-lg font-semibold">Add New Device</h2>
            <p className="mt-1 text-sm text-gray-500">
              Generate a token to authorize your VS Code extension to sync stats.
            </p>

            <form onSubmit={handleGenerateToken} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Device Name</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="e.g., MacBook Pro, Desktop Windows"
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                  required
                  maxLength={100}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateToken.isPending || !newDeviceName.trim()}
                  className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {generateToken.isPending ? "Generating..." : "Generate Token"}
                </button>
              </div>
            </form>

            {generateToken.data && (
              <div className="mt-4 space-y-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Token Generated
                </p>
                <code className="block break-all rounded bg-white p-2 text-xs font-mono text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                  {generateToken.data.token.slice(0, 50)}...
                </code>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Copy this token and paste it in your extension settings. It expires in 24 hours.
                </p>
                <button
                  onClick={() =>
                    generateToken.data && copyToClipboard(generateToken.data.token)
                  }
                  className="w-full rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {copiedToken ? "Copied!" : "Copy Token"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
