export interface AdminSidebarNavItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  order: number;
  route?: string;
  badge?: {
    text: string;
    color: 'primary' | 'accent' | 'warn' | 'success';
  };
  isVisible?: boolean;
  permissions?: string[];
}

export interface AdminSidebarSection {
  id: string;
  label: string;
  icon: string;
  order: number;
  items: AdminSidebarNavItem[];
  isExpanded?: boolean;
  isCollapsible?: boolean;
}

export const ADMIN_SIDEBAR_CONFIG: AdminSidebarSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'dashboard',
    order: 1,
    isExpanded: true,
    isCollapsible: false,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        description: 'Overview and statistics',
        order: 1,
        route: 'dashboard'
      }
    ]
  },
  {
    id: 'management',
    label: 'Management',
    icon: 'manage_accounts',
    order: 2,
    isExpanded: true,
    isCollapsible: true,
    items: [
      {
        id: 'users',
        label: 'Users',
        icon: 'people',
        description: 'Manage user accounts',
        order: 1,
        route: 'users',
        permissions: ['admin']
      },
      {
        id: 'feedback',
        label: 'User Feedback',
        icon: 'feedback',
        description: 'View and manage user feedback',
        order: 2,
        route: 'feedback',
        permissions: ['admin']
      },
      {
        id: 'contact',
        label: 'Get In Touch',
        icon: 'contact_mail',
        description: 'View messages from contact form',
        order: 3,
        route: 'contact',
        permissions: ['admin']
      }
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'analytics',
    order: 3,
    isExpanded: true,
    isCollapsible: true,
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        icon: 'analytics',
        description: 'App usage statistics',
        order: 1,
        route: 'analytics',
        permissions: ['admin']
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: 'assessment',
        description: 'Generate and view reports',
        order: 2,
        route: 'reports',
        permissions: ['admin'],
        isVisible: false // Hidden for future implementation
      }
    ]
  },
  {
    id: 'system',
    label: 'System',
    icon: 'settings',
    order: 4,
    isExpanded: true,
    isCollapsible: true,
    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: 'settings',
        description: 'Admin configuration',
        order: 1,
        route: 'settings',
        permissions: ['admin']
      },
      {
        id: 'logs',
        label: 'System Logs',
        icon: 'list_alt',
        description: 'View system logs',
        order: 2,
        route: 'logs',
        permissions: ['admin'],
        isVisible: false // Hidden for future implementation
      },
      {
        id: 'backup',
        label: 'Backup & Restore',
        icon: 'backup',
        description: 'Data backup and restore',
        order: 3,
        route: 'backup',
        permissions: ['admin'],
        isVisible: false // Hidden for future implementation
      }
    ]
  }
];

// Helper functions
export const getAllAdminSections = (): AdminSidebarSection[] => {
  return ADMIN_SIDEBAR_CONFIG
    .sort((a, b) => a.order - b.order)
    .map(section => ({
      ...section,
      items: section.items
        .filter(item => item.isVisible !== false)
        .sort((a, b) => a.order - b.order)
    }));
};

export const getAdminSectionById = (sectionId: string): AdminSidebarSection | undefined => {
  return ADMIN_SIDEBAR_CONFIG.find(section => section.id === sectionId);
};

export const getAllAdminItems = (): AdminSidebarNavItem[] => {
  return ADMIN_SIDEBAR_CONFIG
    .flatMap(section => section.items)
    .filter(item => item.isVisible !== false)
    .sort((a, b) => a.order - b.order);
};

export const getAdminItemById = (itemId: string): AdminSidebarNavItem | undefined => {
  return getAllAdminItems().find(item => item.id === itemId);
};

export const getVisibleAdminItems = (userPermissions: string[] = []): AdminSidebarNavItem[] => {
  return getAllAdminItems().filter(item => {
    if (!item.permissions) return true;
    return item.permissions.some(permission => userPermissions.includes(permission));
  });
};

export const getAdminNavigationItems = (userPermissions: string[] = []): AdminSidebarNavItem[] => {
  return getVisibleAdminItems(userPermissions).filter(item => item.route);
}; 