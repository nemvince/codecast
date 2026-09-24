import type { ReactNode } from 'react'
import { CaretDownIcon, DesktopIcon, MoonIcon, SunIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { setThemeMode, THEME_LABELS, THEME_MODES, type ThemeMode, useThemeMode } from '@/lib/theme'

const MODE_ICONS: Record<ThemeMode, ReactNode> = {
  auto: <DesktopIcon />,
  dark: <MoonIcon />,
  light: <SunIcon />
}

export const ThemeToggle = () => {
  const mode = useThemeMode()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label={`Theme: ${THEME_LABELS[mode]}`} size='sm' variant='outline' />}
      >
        {MODE_ICONS[mode]}
        {THEME_LABELS[mode]}
        <CaretDownIcon className='text-muted-foreground' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuRadioGroup
          onValueChange={(value) => setThemeMode(value as ThemeMode)}
          value={mode}
        >
          {THEME_MODES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {MODE_ICONS[option]}
              {THEME_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
