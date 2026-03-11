export interface SidebarNavChild {
  label: string;
  route: string;
  icon: string;
  order: number;
  isPremium?: boolean;
  queryParams?: any;
  externalUrl?: string;
  /** If true, only show this item when the user has family mode active */
  familyOnly?: boolean;
  /** If true, hide this item when the user has family mode active */
  hideInFamily?: boolean;
}

export interface SidebarNavParent {
  label: string;
  icon: string;
  order: number;
  children: SidebarNavChild[];
  isExpanded?: boolean;
  isCollapsible?: boolean;
}

export const SIDEBAR_NAVIGATION_CONFIG: SidebarNavParent[] = [
  {
    label: 'NAVIGATION.NAV_SECTION',
    icon: 'navigation',
    order: 1,
    isExpanded: true,
    isCollapsible: true,
    children: [
       {
        label: 'NAVIGATION.GROUP_SELECTION',
        route: '/dashboard/family/groups',
        icon: 'group',
        order: 1,
        familyOnly: true
      },
      {
        label: 'NAVIGATION.ACCOUNTS',
        route: '/dashboard/accounts',
        icon: 'account_balance',
        order: 2
      },
       {
        label: 'NAVIGATION.CATEGORIES',
        route: '/dashboard/category',
        icon: 'category',
        order: 3
      },
        {
        label: 'NAVIGATION.REPORTS',
        route: '/dashboard/reports',
        icon: 'analytics',
        order: 4
      },
      // {
      //   label: 'NAVIGATION.TRANSACTIONS',
      //   route: '/dashboard/transactions',
      //   icon: 'receipt_long',
      //   order: 3
      // },
     
      {
        label: 'NAVIGATION.RECURRING',
        route: '/dashboard/transactions',
        queryParams: { tab: 'recurring' },
        icon: 'repeat',
        order: 5
      },
     
      {
        label: 'NAVIGATION.BUDGETS',
        route: '/dashboard/budgets',
        icon: 'pie_chart',
        order: 6
      },
    
    ]
  },
  {
    label: 'NAVIGATION.TOOLS',
    icon: 'build',
    order: 2,
    isExpanded: true,
    isCollapsible: true,
    children: [
      {
        label: 'NAVIGATION.BACKUP_RESTORE',
        route: '/dashboard/backup-restore',
        icon: 'settings_backup_restore',
        order: 1
      },
      {
        label: 'NAVIGATION.AUTO_SYNC',
        route: '/dashboard/auto-sync',
        icon: 'sync',
        order: 1.5,
      },
      {
        label: 'NAVIGATION.TAX',
        route: '/dashboard/tax',
        icon: 'calculate',
        order: 2,
        isPremium: false,
        hideInFamily: true
      },
      {
        label: 'Family Groups',
        route: '/dashboard/family',
        icon: 'family_restroom',
        hideInFamily: true,
        order: 3
      },
      {
        label: 'NAVIGATION.GOOGLE_SHEETS',
        route: '/dashboard/google-sheets',
        icon: 'table_chart',
        order: 5,
        isPremium: false,
        hideInFamily: true
      },
      {
        label: 'Connect AI Models',
        route: '/dashboard/openai-interaction',
        icon: 'smart_toy',
        order: 6,
        hideInFamily: true,
        isPremium: false
      },
      {
        label: 'NAVIGATION.LOAN_CALCULATOR',
        route: '/dashboard/loan-calculator',
        icon: 'calculate',
        hideInFamily: true,
        order: 7
      }
    ]
  },
  {
    label: 'NAVIGATION.ACCOUNT',
    icon: 'person',
    order: 3,
    isExpanded: true,
    isCollapsible: true,
    children: [
      {
        label: 'NAVIGATION.PROFILE',
        route: '/dashboard/profile',
        icon: 'account_circle',
        order: 1
      },
      {
        label: 'NAVIGATION.NOTIFICATIONS_NAV',
        route: '/dashboard/notifications',
        icon: 'notifications',
        order: 3
      },
      {
        label: 'NAVIGATION.FEEDBACK',
        route: '/dashboard/feedback',
        icon: 'feedback',
        order: 4
      },
      // {
      //   label: 'NAVIGATION.GITHUB_SUPPORT',
      //   route: '',
      //   externalUrl: 'https://github.com/prashiln79/money-manager',
      //   icon: 'svg:github',
      //   order: 5
      // }
    ]
  }
];

export const getAllNavigationItems = (): SidebarNavParent[] => {
  return SIDEBAR_NAVIGATION_CONFIG.sort((a, b) => a.order - b.order);
};

export const getNavigationSection = (): SidebarNavParent | undefined => {
  return SIDEBAR_NAVIGATION_CONFIG.find(section => section.label === 'Navigation');
};

export const getToolsSection = (): SidebarNavParent | undefined => {
  return SIDEBAR_NAVIGATION_CONFIG.find(section => section.label === 'Tools');
}; 