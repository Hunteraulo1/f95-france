<script lang="ts">
  let { isSidebarOpen = $bindable() }: { isSidebarOpen: boolean } = $props();
</script>

<header
  class="bg-white dark:bg-gray-900 shadow-[0_2px_0_0] dark:shadow-slate-700 shadow-slate-200 h-16 flex items-center justify-between px-4 relative z-10"
>
    <!-- <a href="/">
        <img src="/logo.svg" alt="F95 France" class="h-10" />
    </a> -->
    <div class="flex items-center space-x-4">
        <button
          aria-label="Toggle sidebar"
          onclick={() => isSidebarOpen = !isSidebarOpen}
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
    </div>
</header>
