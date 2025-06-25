export function useTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    )
}

export function toTitleCase(str: string): string {
    return str.split(/(?=[A-Z])/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}